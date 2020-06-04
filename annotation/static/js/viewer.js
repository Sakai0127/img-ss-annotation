let src_img = null;
let main_canvas = null;
let main_canvas_ctx = null;

let color_list = null;

var draw_flag = false;
var x = 0;
var y = 0;
var scale = 1.0;
var pad = 0;

var file_name = 'no_img';
var safebooru = false;

function init_image() {
    main_canvas[0].width = src_img[0].naturalWidth;
    main_canvas[0].height = src_img[0].naturalHeight;
    main_canvas.css("opacity", $("#alpha-slider").val());
    main_canvas_ctx.fillStyle = "#FFFFFF";
    main_canvas_ctx.fillRect(0, 0, main_canvas[0].width, main_canvas[0].height);
    var data = main_canvas[0].toDataURL();
    $(".card-image>img").each(function (index, element) {
        element.src = data;
    });
};

function toBase64(img){
    var cvs = document.createElement("canvas");
    cvs.width  = src_img[0].naturalWidth;
    cvs.height = src_img[0].naturalHeight;
    var ctx = cvs.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return cvs.toDataURL();
};

function get_color (str) {
    return [parseInt(str.substr(1, 2), 16), parseInt(str.substr(3, 2), 16), parseInt(str.substr(5, 2), 16)];
};

$(function(){
    src_img = $("#src-img");
    main_canvas = $("#mask-canvas");
    main_canvas_ctx = main_canvas[0].getContext("2d");

    $("label#fg").css("background-color", $("label#fg>input").attr("value"));
    $("label#pfg").css("background-color", $("label#pfg>input").attr("value"));
    $("label#bg").css("background-color", $("label#bg>input").attr("value"));
    $("label#pbg").css("background-color", $("label#pbg>input").attr("value"));
    color_list = {
        'fg' : get_color($("label#fg>input").attr("value")),
        'pfg' : get_color($("label#pfg>input").attr("value")),
        'bg' : get_color($("label#bg>input").attr("value")),
        'pbg' : get_color($("label#pbg>input").attr("value"))
    };

    $("#get-img").on("click", function (event) {
        $(this).attr("value", "Loading...")
        var id_data = JSON.stringify({'id':$("#image-id").val()});
        file_name = String($("#image-id").val());
        safebooru = true;
        $.ajax({
            type: "POST",
            url: "/get-img",
            contentType: "application/json; charset=utf-8",
            data: id_data,
            dataType: "json",
            success: function (response) {
                var result = JSON.parse(response.ResultSet).img;
                src_img.attr("src", result);
                $("#get-img").attr("value", "Get Image");
            }
        });
    });

    $("#local-file").on('change', function(event){
        safebooru = false;
        var reader = new FileReader();
        reader.onload = function(event){
            file_name = $("#local-file")[0].files[0].name.split('.')[0]
            src_img.attr('src', event.target.result)
        };
        reader.readAsDataURL(event.target.files[0])
    });

    $("#alpha-slider").on("input", function( event ) {
        main_canvas.css("opacity", $(this).val());
    });

    $("#clear-canvas").on("click", function(){
        main_canvas_ctx.fillStyle = "#FFFFFF";
        main_canvas_ctx.fillRect(0, 0, main_canvas[0].width, main_canvas[0].height);
    });

    $("#src-img").on("load", function(){
        init_image();
    });

    $("input#grabcut").on("click", function(){
        $(this).attr("value", "Wait....");
        var img_data = {
            'src_img':toBase64(src_img[0]),
            'mask_img':main_canvas[0].toDataURL(),
        };
        var send_data = Object.assign(img_data, color_list);
        $.ajax({
            type: "POST",
            url: "/grabcut",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(send_data),
            dataType: "json",
            success: function (response) {
                var result = JSON.parse(response.ResultSet).mask;
                var img = new Image();
                img.src = result;
                img.onload = function(){
                    main_canvas_ctx.drawImage(img, 0, 0);
                    delete img;
                };
                $("input#grabcut").attr("value", "GrabCut");
            }
        });
    });

    $("input#set-img").on("click", function(){
        var v = $("select#l-name").val()
        var cvs1 = document.createElement("canvas")
        cvs1.width = main_canvas[0].width;
        cvs1.height = main_canvas[0].height;
        var ctx1 = cvs1.getContext("2d")
        var imgdata = main_canvas_ctx.getImageData(0,0,main_canvas[0].width, main_canvas[0].height);
        var data = imgdata.data
        var target_imgdata = ctx1.createImageData(imgdata)
        var target_data = target_imgdata.data
        for (var i = 0; i < data.length; i += 4){
            if (data[i]==color_list['pfg'][0]&&data[i+1]==color_list['pfg'][1]&&data[i+2]==color_list['pfg'][2]){
                target_data[i] = color_list['fg'][0];
                target_data[i+1] = color_list['fg'][1];
                target_data[i+2] = color_list['fg'][2];
                target_data[i+3] = data[i+3];
            } else if (data[i]==color_list['pbg'][0]&&data[i+1]==color_list['pbg'][1]&&data[i+2]==color_list['pbg'][2]) {
                target_data[i] = color_list['bg'][0];
                target_data[i+1] = color_list['bg'][1];
                target_data[i+2] = color_list['bg'][2];
                target_data[i+3] = data[i+3];
            } else {
                target_data[i] = data[i];
                target_data[i+1] = data[i+1];
                target_data[i+2] = data[i+2];
                target_data[i+3] = data[i+3];
            };
        };
        ctx1.putImageData(target_imgdata, 0, 0)
        $(".card-image>img#"+v).attr("src", cvs1.toDataURL())
        if (v == 'fg'|| v == 'bg'){
            var cvs2 = document.createElement("canvas")
            cvs2.width = main_canvas[0].width;
            cvs2.height = main_canvas[0].height;
            var ctx2 = cvs2.getContext("2d");
            var target_imgdata2 = ctx2.createImageData(target_imgdata);
            var target_data2 = target_imgdata2.data
            for (var j = 0; j < target_data.length; j += 4){
                if (target_data[j]==color_list['fg'][0]&&target_data[j+1]==color_list['fg'][1]&&target_data[j+2]==color_list['fg'][2]){
                    target_data2[j] = color_list['bg'][0]
                    target_data2[j+1] = color_list['bg'][1]
                    target_data2[j+2] = color_list['bg'][2]
                    target_data2[j+3] = target_data[j+3]
                } else {
                    target_data2[j] = color_list['fg'][0]
                    target_data2[j+1] = color_list['fg'][1]
                    target_data2[j+2] = color_list['fg'][2]
                    target_data2[j+3] = target_data[j+3]
                }
            };
            ctx2.putImageData(target_imgdata2, 0, 0)
            var v2 = ['fg', 'bg'].splice(['fg', 'bg'].indexOf(v)-1, 1)
            $(".card-image>img#"+v2[0]).attr("src", cvs2.toDataURL())
        };
    });

    main_canvas.mousedown(function (event) { 
        draw_flag = true;
        pad = parseInt(main_canvas.css("padding"))
        scale = (main_canvas[0].scrollHeight - pad*2) / main_canvas[0].height
        var rect = event.target.getBoundingClientRect();
        x = parseInt((event.clientX - rect.left - pad) / scale);
        y = parseInt((event.clientY - rect.top - pad) / scale);
    });

    main_canvas.mousemove(function (e) { 
        // values: e.clientX, e.clientY, e.pageX, e.pageY
        if (!draw_flag) {
            return;
        };
        var rect = e.target.getBoundingClientRect();
        var x_ = parseInt((e.clientX - rect.left - pad) / scale);
        var y_ = parseInt((e.clientY - rect.top - pad) / scale);

        main_canvas_ctx.lineCap = 'round';
        main_canvas_ctx.strokeStyle = $("input[name=mode]:checked").val();
        main_canvas_ctx.lineWidth = $("input#draw-size").val();
        main_canvas_ctx.beginPath();
        main_canvas_ctx.moveTo(x, y);
        main_canvas_ctx.lineTo(x_, y_);
        main_canvas_ctx.stroke();
        main_canvas_ctx.closePath();
        x = x_;
        y = y_;
    });

    main_canvas.mouseup(function () { 
        draw_flag = false
    });

    $("input#save-drive").on("click", function(){
        $(this).attr("value", "Saving...");
        var img_elems = $(".card-image>img");
        var imgs = {};
        for ( var i = 0; i < img_elems.length; i++){
            imgs[img_elems[i].id] = toBase64(img_elems[i]);
        };

        var send_data = {'name':file_name,
                         'safebooru':safebooru,
                         'imgs':imgs,
                         'colors':color_list};
        $.ajax({
            type: "POST",
            url: "/upload-google-drive",
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(send_data),
            dataType: "json",
            success: function (response) {
                $("#save-drive").attr("value", "Save to Google Drive");
            }
        });
    });

    $("input#download-data").on("click", function(){
        $(this).attr("value", "Wait....");
        var img_elems = $(".card-image>img");
        var imgs = {};
        for ( var i = 0; i < img_elems.length; i++){
            imgs[img_elems[i].id] = toBase64(img_elems[i]);
        };
        var send_data = {'name':file_name,
                         'safebooru':safebooru,
                         'imgs':imgs,
                         'colors':color_list};
        var xhr = new XMLHttpRequest();
        xhr.open("POST", "/download");
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.responseType = "arraybuffer";
        xhr.onload = function(e){
            var data = xhr.response;
            var blob = new Blob([data]);
            var link = document.createElement("a");
            link.download = send_data["name"]+".pkl";
            link.href = URL.createObjectURL(blob);
            link.click()
            URL.revokeObjectURL(link.href)
        };
        xhr.send(JSON.stringify(send_data));
        $(this).attr("value", "Download");
    });

    $("#add-label").on("click", function(){
        var l_name = $("#label-name-text").val();
        var cur_names = [];
        var c = $(".card-image>img");
        for(var i = 0; i < c.length; i++){
            cur_names.push(c[i].id);
        };
        if (l_name.length == 0){
            window.alert("You must enter label name.");
            return;
        } else if (cur_names.includes(l_name)) {
            window.alert("Label name must be uneque.");
            return;
        };
        var cnv = document.createElement("canvas");
        cnv.width = src_img[0].naturalWidth;
        cnv.height = src_img[0].naturalHeight;
        var ctx = cnv.getContext("2d");
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, cnv.width, cnv.height);
        var data = cnv.toDataURL();
        var template = "<div class=\"card z-depth-1\">"+
                            "<div class=\"card-image z-depth-1\">"+
                                `<img alt=${l_name} id=${l_name} src=${data}>`+
                            "</div>"+
                            "<div class=\"card-content\">"+
                                `<span class="card-title">${l_name}</span>`+
                            "</div>"+
                            "<div class=\"card-action\">"+
                                `<button id=\"delete-${l_name}\" class=\"btn\"><i class=\"small material-icons\">delete</i></button>`+
                            "</div>"+
                        "</div>"
        $("#mask-images").append(template);
        $("#l-name").append(`<option value=${l_name}>${l_name}</option>`);
        $("#delete-"+l_name).on("click", function(){
            var n = $(this).attr("id").split("-")[1];
            var ans = window.confirm(`Are you sure that you want to delete \"${n}\"?`);
            $(this).parents(".card").remove();
            $(`#l-name>option[value=${l_name}]`).remove();
            $('select').formSelect();
        });
        $('select').formSelect();
    });

    $('select').formSelect();
});

$(window).on('load', function () {  
    init_image();
});