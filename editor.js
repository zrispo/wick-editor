$(document).ready(function() {

	// Global editor vars
	var showUploadAlert = false;

	// Setup canvas
	var canvas = new fabric.Canvas('canvas');
	canvas.selectionColor = 'rgba(0,0,5,0.1)';
	canvas.selectionBorderColor = 'grey';
	canvas.selectionLineWidth = 2;

	var ctx = canvas.getContext('2d');

/*****************************
	Temporary GUI events
*****************************/

	$("#prevFrameButton").on("click", function(e){ 
		prevFrame(); 
	});
	$("#nextFrameButton").on("click", function(e){ 
		nextFrame(); 
	});
	$("#cloneFrameButton").on("click", function(e){ 
		cloneFrame(); 
	});
	$("#gotoFrameButton").on("click", function(e){
		var toFrame = parseInt($('textarea#frameSelector').val());
		goToFrame(toFrame);
	});
	$("#deleteObjectButton").on("click", function(e){
		canvas.getActiveObject().remove();
	});
	$("#exportButton").on("click", function(e){
		console.log(JSON.stringify(canvas));
	});

/*****************************
	Mouse events
*****************************/

	// Save mouse coordinates within the canvas.
	// NOTE: This only works properly when the window is in focus.
	canvas.on('mouse:move', function(event) {
		var pointer = canvas.getPointer(event.e);
		canvas.px = pointer.x;
		canvas.py = pointer.y;
	});

/*****************************
	Key Events
*****************************/

	var keys = [];
	var action = false;

	document.body.addEventListener("keydown", function (e) {
	  keys[e.keyCode] = true;
		action = true;
		checkKeys();
	});

	document.body.addEventListener("keyup", function (e) {
	  keys[e.keyCode] = false;
		action = false;
	});

	function checkKeys() {
		if (keys[16]) { // Shift
			if (keys[39]) { // Right arrow
				nextFrame();
			} else if (keys[37]) { // Left arrow
				prevFrame();
			}
		}
	}

/*****************************
	Drag and drop events
*****************************/

	$("#canvasContainer").on('dragover', function(e) {
		showUploadAlert = true;
		return false;
	});
	$("#canvasContainer").on('dragleave', function(e) {
		showUploadAlert = false;
		return false;
	});
	$("#canvasContainer").on('drop', function(e) {
		// prevent browser from open the file when drop off
		e.stopPropagation();
		e.preventDefault();

		// retrieve uploaded files data
		// TODO: multiple files at once
		var files = e.originalEvent.dataTransfer.files;
		var file = files[0];

		// read file as data URL
		var reader = new FileReader();
		reader.onload = (function(theFile) {
			return function(e) {
				fabric.Image.fromURL(e.target.result, function(oImg) {
					// add new object to fabric canvas
					oImg.left = (canvas.width/2) - (oImg.width/2);
					oImg.top = (canvas.height/2) - (oImg.height/2);
					canvas.add(oImg);
				});
			};
		})(file);
		reader.readAsDataURL(file);

		showUploadAlert = false;

		return false;
	});

/*****************************
	Timeline
*****************************/

	var _frames = [];
	var currentFrame = 1;
	document.getElementById("frameSelector").value = currentFrame;

	// Load and store serialized frames
	function storeFrame(frame) {
		_frames[frame] = JSON.stringify(canvas);
	}
	function loadFrame(frame) {
		if (_frames[frame] === undefined) {
			// We're in a frame that doesn't exist. Just draw a blank canvas.
			canvas.clear();
		} else {
			// Load the JSON string and immediately use canvas.renderAll as a callback
			canvas.loadFromJSON(_frames[frame], canvas.renderAll.bind(canvas));
		}
	}

	// Goes to a specified frame
	function goToFrame(toFrame) {
		storeFrame(currentFrame);

		currentFrame = toFrame;
		loadFrame(currentFrame);

		document.getElementById("frameSelector").value = currentFrame;
	}

	// Make new frame that is identical to current frame
	// TODO: this don't work bc canvas.loadFromJSON replaces current stuff......
	function cloneFrame() {
		currentFrame++;
		loadFrame(currentFrame);

		document.getElementById("frameSelector").value = currentFrame;
	}

	// Go to the next frame.
	function nextFrame() {
		goToFrame(currentFrame + 1);
	}

	// Go to the previous frame.
	function prevFrame() {
		var toFrame = currentFrame - 1;
		if (toFrame > 0) {
			goToFrame(toFrame);
		}
	}

/*****************************
	Draw loop
*****************************/

	// update canvas size on window resize
	window.addEventListener('resize', resizeCanvas, false);
	function resizeCanvas() {
		// for raw html5 canvas
		//canvas.width = window.innerWidth;
		//canvas.height = window.innerHeight;

		// for fabric.js canvas
		canvas.setWidth( window.innerWidth );
		canvas.setHeight( window.innerHeight );

		canvas.calcOffset();
	}
	resizeCanvas();

	// start draw/update loop
	var FPS = 30;
	setInterval(function() {
		draw();
	}, 1000/FPS);

	function draw() {
		if(showUploadAlert) {
			ctx.fillStyle = '#000000';
			ctx.textAlign = 'center';
			ctx.font = "30px Arial";
			ctx.fillText("Drop image to add to scene...",
			              canvas.width/2,canvas.height/2);
		}
	}
})