/* Wick - (c) 2016 Zach Rispoli, Luca Damasco, and Josh Rispoli */

var FabricInterface = function (wickEditor) {

    var that = this;

    var shapeStartPos = {x:0,y:0};

    this.setup = function () {

        this.canvas = new fabric.CanvasEx('fabricCanvas', {
            imageSmoothingEnabled : false,
            preserveObjectStacking : true,
            renderOnAddRemove : false,
        });
        this.canvas.selectionColor = 'rgba(110, 110, 115, 0.1)';
        this.canvas.selectionBorderColor = 'grey';
        this.canvas.backgroundColor = "#EEE";
        this.canvas.setWidth(window.innerWidth);
        this.canvas.setHeight(window.innerHeight);

        this.panning = false;
        this.onionSkinsDirty = false;

        this.shapeDrawer   = new FabricShapeDrawer(wickEditor, this);
        this.paperElements = new FabricPaperElements(wickEditor, this);
        this.guiElements   = new FabricGUIElements(wickEditor, this);
        this.wickElements  = new FabricWickElements(wickEditor, this);
        this.symbolBorders = new FabricSymbolBorders(wickEditor, this);
        
        this.tools = {
            "cursor"           : new Tools.Cursor(wickEditor),
            "paintbrush"       : new Tools.Paintbrush(wickEditor),
            "fillbucket"       : new Tools.FillBucket(wickEditor),
            "rectangle"        : new Tools.Rectangle(wickEditor),
            "ellipse"          : new Tools.Ellipse(wickEditor),
            "dropper"          : new Tools.Dropper(wickEditor),
            "text"             : new Tools.Text(wickEditor),
            "zoom"             : new Tools.Zoom(wickEditor),
            "pan"              : new Tools.Pan(wickEditor),
            "backgroundremove" : new Tools.BackgroundRemove(wickEditor),
            "crop"             : new Tools.Crop(wickEditor),
        }

        this.currentTool = this.tools.cursor;
        this.lastTool = this.currentTool;

    // Update the scripting GUI/properties box when the selected object changes
        that.canvas.on('object:selected', function (e) {
            wickEditor.timeline.redraw();
            
            wickEditor.scriptingide.editScriptsOfObject(e.target.wickObjReference, {dontOpenIDE:true});
            wickEditor.scriptingide.syncWithEditorState();
            wickEditor.properties.syncWithEditorState();
            e.target.on({
                moving: e.target.setCoords,
                scaling: e.target.setCoords,
                rotating: e.target.setCoords
            });
        });
        that.canvas.on('selection:cleared', function (e) {
            wickEditor.timeline.redraw();

            wickEditor.scriptingide.clearSelection();
            wickEditor.scriptingide.syncWithEditorState();
            wickEditor.properties.syncWithEditorState();
        });
        that.canvas.on('selection:changed', function (e) {
            wickEditor.timeline.redraw();

            wickEditor.scriptingide.editScriptsOfObject(this.getSelectedWickObject(), {dontOpenIDE:true});
            that.guiElements.update();
            wickEditor.scriptingide.syncWithEditorState();
            wickEditor.properties.syncWithEditorState();
        });

        // Listen for objects being changed so we can undo them in the action handler.
        that.canvas.on('object:modified', function(e) {
            that.modifyChangedObjects(e);
        });

        this.recenterCanvas();
        this.guiElements.update();

        window.addEventListener('resize', this.resize, false);

    }

    this.syncWithEditorState = function () {

        // Apply tweens
        wickEditor.project.rootObject.applyTweens();

        // Update cursor
        that.updateCursor();

        // Set drawing mode
        if(that.currentTool instanceof Tools.Paintbrush) {
            this.canvas.isDrawingMode = true;
            this.canvas.freeDrawingBrush.width = that.currentTool.brushSize;
            this.canvas.freeDrawingBrush.color = that.currentTool.color;
        } else {
            this.canvas.isDrawingMode = false;
        }

        // Disable selection
        if(that.currentTool instanceof Tools.Cursor) {
            that.canvas.selection = true;
        } else {
            that.canvas.selection = false;
        }

        // Update elements in fabric canvas
        this.wickElements.update();
        that.guiElements.update();
        this.paperElements.update();

        // Render canvas
        this.canvas.renderAll();
    }

    this.resize = function () {

        var oldWidth = that.canvas.getWidth();
        var oldHeight = that.canvas.getHeight();

        that.canvas.setWidth ( window.innerWidth  );
        that.canvas.setHeight( window.innerHeight );
        that.canvas.calcOffset();

        var diffWidth = that.canvas.getWidth() - oldWidth;
        var diffHeight = that.canvas.getHeight() - oldHeight;

        var panAdjustX = Math.floor(diffWidth/2);
        var panAdjustY = Math.floor(diffHeight/2);

        that.canvas.relativePan(new fabric.Point(panAdjustX,panAdjustY));
        that.canvas.renderAll();

    }

    this.changeTool = function (newTool) {
        that.lastTool = that.currentTool;
        that.currentTool = newTool;
        that.forceModifySelectedObjects();
        that.deselectAll();
        wickEditor.syncInterfaces();
    }

    this.useLastUsedTool = function () {
        that.currentTool = that.lastTool;
    }

    this.recenterCanvas = function () {
        var centerX = Math.floor(-(window.innerWidth -wickEditor.project.resolution.x)/2 - 33/2 + 254/2);
        var centerY = Math.floor(-(window.innerHeight-wickEditor.project.resolution.y)/2 - 116/2);

        that.canvas.setZoom(1);
        that.canvas.absolutePan(new fabric.Point(centerX,centerY));
        that.canvas.renderAll();
        wickEditor.syncInterfaces();
    }

    this.relativePan = function (x,y) {
        var delta = new fabric.Point(Math.floor(x),Math.floor(y));
        that.canvas.relativePan(delta)
        that.guiElements.update();
    }

    this.absolutePan = function (x,y) {
        var delta = new fabric.Point(Math.floor(x),Math.floor(y));
        that.canvas.absolutePan(delta)
        that.guiElements.update();
    }

    this.startPan = function () {
        that.panning = true;
        that.canvas.selection = false;
    }

    this.stopPan = function () {
        that.panning = false;
        that.canvas.selection = true;
    }

    this.getPan = function () {
        return {
            x: that.canvas.viewportTransform[4],
            y: that.canvas.viewportTransform[5]
        }
    }

    this.zoom = function (zoomAmount) {
        // Calculate new zoom amount
        var oldZoom = that.canvas.getZoom();
        var newZoom = that.canvas.getZoom() * zoomAmount;

        // Calculate pan position adjustment so we zoom into the mouse's position
        var panAdjustX = (wickEditor.inputHandler.mouse.x) * (1-zoomAmount);
        var panAdjustY = (wickEditor.inputHandler.mouse.y) * (1-zoomAmount);

        // Do da zoom!
        that.canvas.setZoom(newZoom);
        that.canvas.relativePan(new fabric.Point(panAdjustX,panAdjustY));
        //that.canvas.renderAll();

        that.guiElements.update();
        that.updateCursor();

        //wickEditor.syncInterfaces();
    }

    this.screenToCanvasSpace = function (x,y) {
        var pan = that.getPan();
        var zoom = that.canvas.getZoom();
        return {
            x: (x - pan.x)/zoom,
            y: (y - pan.y)/zoom
        }
    }

    this.screenToCanvasSize = function (x,y) {
        var zoom = that.canvas.getZoom();
        return {
            x: x/zoom,
            y: y/zoom
        }
    }

    this.updateCursor = function () {
        var cursorImg = that.currentTool.getCursorImage();
        this.canvas.defaultCursor = cursorImg;
        this.canvas.freeDrawingCursor = cursorImg;
    }

    this.getObjectByWickObjectID = function (wickObjID) {
        var foundFabricObject = null;

        this.canvas.forEachObject(function(fabricObject) {
            if(fabricObject.wickObjectID === wickObjID) {
                foundFabricObject = fabricObject;
            }
        });

        return foundFabricObject;
    }

    this.getObjectByPaperObjectRef = function (paperObjectRef) {
        var foundFabricObject = null;

        this.canvas.forEachObject(function(fabricObject) {
            if(foundFabricObject) return;
            if(fabricObject.paperObjectReference === paperObjectRef) {
                foundFabricObject = fabricObject;
            }
        });

        return foundFabricObject;
    }

    this.getBoundingBoxOfObjects = function (ids) {
        var group = new fabric.Group([], {
            originX: 'left',
            originY: 'top'
        });

        var boundingBoxObjects = []; 
        this.canvas.forEachObject(function(fabricObj) {
            if(ids.indexOf(fabricObj.wickObjectID) !== -1) {
                boundingBoxObjects.push(fabricObj);
            }
        });
        for(var i = 0; i < boundingBoxObjects.length; i++) {
            group.canvas = this.canvas // WHAT ??????????????? WHY
            group.addWithUpdate(boundingBoxObjects[i]);
        }

        group.setCoords();
        var bbox = group.getBoundingRect();
        for(var i = 0; i < boundingBoxObjects.length; i++) {
            group.canvas = this.canvas // WHAT ??????????????? WHY
            group.removeWithUpdate(boundingBoxObjects[i]);
        }

        var bboxXY = that.screenToCanvasSpace(bbox.left, bbox.top);
        var bboxSize = that.screenToCanvasSize(bbox.width, bbox.height);

        bbox.left = bboxXY.x;
        bbox.top = bboxXY.y;
        bbox.width = bboxSize.x;
        bbox.height = bboxSize.y;

        return bbox;
    }

    this.getBoundingBoxOfAllObjects = function () {
        var ids = [];
        this.canvas.forEachObject(function (o) {
            if(o.wickObjectID && o.selectable) {
                ids.push(o.wickObjectID);
            }
        });
        return that.getBoundingBoxOfObjects(ids);
    }

    this.selectByIDs = function (ids) {
        wickEditor.timeline.redraw();

        if(ids.length == 0) {
            return;
        }

        var selectedObjs = []; 
        this.canvas.forEachObject(function(fabricObj) {
            if(ids.indexOf(fabricObj.wickObjectID) != -1) {
                fabricObj.set('active', true);
                selectedObjs.push(fabricObj);
            }
        });
        selectedObjs.reverse()

        if(ids.length <= 1) {
            that.canvas._activeObject = selectedObjs[0];
        } else {
            var group = new fabric.Group([], {
                originX: 'left',
                originY: 'top'
            });
            group.on({
                moving: group.setCoords,
                scaling: group.setCoords,
                rotating: group.setCoords
              });
            for(var i = 0; i < selectedObjs.length; i++) {
                group.canvas = this.canvas // WHAT ??????????????? WHY
                group.addWithUpdate(selectedObjs[i]);
            }

            this.canvas._activeObject = null;
            this.canvas.setActiveGroup(group.setCoords()).renderAll();
        }

        that.guiElements.update();
        wickEditor.scriptingide.syncWithEditorState();
        wickEditor.properties.syncWithEditorState();

    }

    this.selectAll = function () {
        wickEditor.timeline.redraw();

        var ids = [];
        this.canvas.forEachObject(function (o) {
            if(o.wickObjectID && o.selectable) {
                ids.push(o.wickObjectID);
            }
        });
        this.selectByIDs(ids);
    }

    this.deselectAll = function (clearScriptingSelection) {
        wickEditor.timeline.redraw();

        if(!clearScriptingSelection)
            wickEditor.scriptingide.clearSelection();

        var activeGroup = this.canvas.getActiveGroup();
        if(activeGroup) {
            activeGroup.removeWithUpdate(activeGroup);
            this.canvas.renderAll();
        }

        this.canvas.deactivateAll().renderAll();

        that.guiElements.update();
        wickEditor.scriptingide.syncWithEditorState();
        wickEditor.properties.syncWithEditorState();

    }

    this.getSelectedObjectIDs = function () {
        var ids = [];

        var obj = this.canvas.getActiveObject();
        var group = this.canvas.getActiveGroup();

        if(obj) {
            ids.push(obj.wickObjectID);
        }

        if(group) {
            for(var i = 0; i < group._objects.length; i++) {
                ids.push(group._objects[i].wickObjectID);
            }
        }

        return ids;
    }

    this.getSelectedWickObject = function () {
        var ids = wickEditor.fabric.getSelectedObjectIDs();
        if(ids.length == 1) {
            return wickEditor.project.getObjectByID(ids[0]);
        } else {
            return null;
        }
    }

    this.getSelectedWickObjects = function () {
        var ids = wickEditor.fabric.getSelectedObjectIDs();
        var wickObjects = [];
        for(var i = 0; i < ids.length; i++) {
            wickObjects.push(wickEditor.project.getObjectByID(ids[i]));
        }
        return wickObjects;
    }

    this.moveSelection = function (x,y) {
        var modifiedStates = [];
        that.getSelectedObjectIDs().forEach(function (id) {
            var wickObj = wickEditor.project.rootObject.getChildByID(id);
            modifiedStates.push({
                x : wickObj.x + x,
                y : wickObj.y + y,
            });
        });

        wickEditor.actionHandler.doAction('modifyObjects', { 
            ids: that.getSelectedObjectIDs(), 
            modifiedStates: modifiedStates 
        });
    }

    this.modifyObjects = function (ids) {
        var modifiedStates = [];

        // For each modified fabric objects (get them by wickobject):
        //    Add new state of that fabric object to modified states
        ids.forEach(function (id) {
            if(!id) return;
            var fabricObj = that.getObjectByWickObjectID(id);
            var wickObj = wickEditor.project.getObjectByID(id);
            if(!wickObj) return;
            var insideSymbolReposition = {
                x: wickObj.x-wickObj.getAbsolutePosition().x,
                y: wickObj.y-wickObj.getAbsolutePosition().y 
            };

            var cornerOffset = {
                x:0,
                y:0
            }
            if(wickObj.isSymbol) {
                //cornerOffset.x = wickObj.getSymbolBoundingBoxCorner().x;
                //cornerOffset.y = wickObj.getSymbolBoundingBoxCorner().y;
            }

            var newX = fabricObj.left + insideSymbolReposition.x - cornerOffset.x;
            var newY = fabricObj.top  + insideSymbolReposition.y - cornerOffset.y;

            modifiedStates.push({
                x      : newX,
                y      : newY,
                scaleX : fabricObj.scaleX,
                scaleY : fabricObj.scaleY,
                flipX  : fabricObj.flipX,
                flipY  : fabricObj.flipY,
                angle  : fabricObj.angle,
                text   : fabricObj.text
            });
        });

        wickEditor.actionHandler.doAction('modifyObjects', {
            ids: ids,
            modifiedStates: modifiedStates
        });
    }

    this.modifyPaths = function (paths) {
        paths.forEach(function (path) {
            var fabricObj = that.getObjectByPaperObjectRef(path);
            if(!fabricObj) return;
            path.position.x = fabricObj.left + fabricObj.width/2;
            path.position.y = fabricObj.top + fabricObj.height/2;
        });
    }

    that.modifyChangedObjects = function (e) {
        if(that.getObjectByWickObjectID(e.target.wickObjectID)) {

            // Deselect everything
            that.deselectAll();

            // Delete text boxes with no text in 'em.
            // if (e.target.text === '') {
            //     var wickObj = wickEditor.project.getCurrentObject().getChildByID(e.target.wickObjectID);
            //     // Make sure the original text comes back on undo
            //     wickObj.text = e.target.originalState.text;
            //     wickEditor.actionHandler.doAction('deleteObjects', { ids:[e.target.wickObjectID] });
            //     return;
            // }

            // Get ids of all selected objects
            var ids = [];
            var paths = [];
            if(e.target.type === "group" && !e.target.wickObjectID) {
                // Selection is a group of objects all selected, not a symbol
                var objects = e.target.getObjects();
                objects.forEach(function (obj) {
                    if(obj.wickObjectID) ids.push(obj.wickObjectID);
                    if(obj.paperObjectReference) paths.push(obj.paperObjectReference);
                });
            } else {
                // Only one object selected
                if(e.target.wickObjectID) ids = [e.target.wickObjectID];
                if(e.target.paperObjectReference) paths = [e.target.paperObjectReference];
                
            }

            that.modifyObjects(ids);
            that.modifyPaths(paths);

            // Reselect everything
            that.selectByIDs(ids);

            wickEditor.syncInterfaces();
        }
    }

    this.forceModifySelectedObjects = function () {
        var wickObj = that.getSelectedWickObject();
        if(wickObj && wickObj.fontData) {
            that.modifyObjects([wickObj.id]);
        }
        wickEditor.syncInterfaces();
    }

    this.getObjectsImage = function (callback, args) {

        var selectedObjs = []; 
        that.canvas.forEachObject(function(fabricObj) {
            if(args && args.ids && args.ids.indexOf(fabricObj.wickObjectID) === -1) return;

            if(fabricObj.wickObjectID && !fabricObj.isWickGUIElement) {
                //fabricObj.set('active', true);
                selectedObjs.push(fabricObj);
            }
        });

        if(selectedObjs.length < 1) {
            //that.canvas._activeObject = selectedObjs[0];
            callback(null);
        } else {
            var group = new fabric.Group([], {
                originX: 'left',
                originY: 'top'
            });
            for(var i = selectedObjs.length-1; i >= 0; i--) {
                //group.canvas = that.canvas // WHAT ??????????????? WHY
                var clone = fabric.util.object.clone(selectedObjs[i]);
                group.addWithUpdate(clone);
            }

            //group.left = Math.round(group.left)
            //group.top = Math.round(group.top)
            group.setCoords();

            var cloneLeft = (group.left)
            var cloneTop = (group.top)

            //var object = fabric.util.object.clone(group);
            var oldZoom = that.canvas.getZoom();
            that.canvas.setZoom(1)
            //that.canvas.renderAll();
            group.setCoords();

            group.cloneAsImage(function (img) { 
                that.canvas.setZoom(oldZoom)
                that.canvas.renderAll();
                group.setCoords();

                group.forEachObject(function(o){ group.removeWithUpdate(o) });
                that.canvas.remove(group);
                that.canvas.renderAll();

                callback({
                    x:cloneLeft,
                    y:cloneTop,
                    src:img.getElement().src,
                });
            })

        }

        
    }
    
}