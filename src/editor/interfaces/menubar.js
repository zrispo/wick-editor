/* Wick - (c) 2016 Zach Rispoli, Luca Damasco, and Josh Rispoli */

var MenuBarInterface = function (wickEditor) {

    this.syncWithEditorState = function () {
        
    }

    document.getElementById('newProjectButton').onclick = function (e) {
        wickEditor.newProject();
    }

    document.getElementById('exportJSONButton').onclick = function (e) {
        wickEditor.project.exportAsJSONFile();
    }

    document.getElementById('openProjectButton').onclick = function (e) {
        $('#importButton').click();
    }

    document.getElementById('exportHTMLButton').onclick = function (e) {
        wickEditor.project.exportAsHTMLFile();
    }

    document.getElementById('runButton').onclick = function (e) {
        wickEditor.runProject();
    }

    document.getElementById('importButton').onchange = function (e) {
        var that = this;

        var filePath = document.getElementById("importButton");
        if(filePath.files && filePath.files[0]) {
            var reader = new FileReader();
            reader.onload = function (e) {
                wickEditor.openProject(e.target.result);
            };
            reader.readAsText(filePath.files[0]);
        }

        var importButton = $("importButton");
        importButton.replaceWith( importButton = importButton.clone( true ) );
    }

}