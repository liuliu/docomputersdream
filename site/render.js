(function () {
	// utility functions
	function shuffle(o) {
		for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
	    return o;
	};

	// channel only triggers once, when count drop to zero
	function Channel(count, done) {
		this.oldCount = this.count = count;
		this.done = done;
	}

	Channel.prototype.setDone = function (done) {
		if (this.count <= 0) {
			done();
		}
		this.done = done;
	}

	Channel.prototype.reset = function () {
		this.count = this.oldCount;
	}

	Channel.prototype.do = function () {
		if (this.count >= 0) {
			--this.count;
			if (this.count == 0) {
				if (this.done) {
					this.done();
				}
			}
		}
	}

	// print text
	function TextLineRender(lines, speed, random, color, font, lineHeight, hOffset) {
		this.lines = lines;
		this.speed = speed;
		this.random = random;
		this.progress = 0;
		this.running = false;
		this.color = color;
		this.font = font;
		this.lineHeight = lineHeight;
		this.hOffset = hOffset;
		this.done = new Channel(1, null);
	}

	TextLineRender.prototype.start = function () {
		this.running = true;
	}

	TextLineRender.prototype.stop = function () {
		this.running = false;
	}

	TextLineRender.prototype.reset = function () {
		this.progress = 0;
		this.running = false;
		this.done.reset();
	}

	TextLineRender.prototype.restart = function () {
		this.progress = 0;
		this.running = true;
		this.done.reset();
	}

	TextLineRender.prototype.setDone = function (done) {
		this.done.setDone(done);
	}

	TextLineRender.prototype.draw = function (surface, dx, dy) {
		if (!this.running) {
			return;
		}
		surface.save();
		surface.fillStyle = this.color;
		surface.font = this.font;
		var chars = Math.round(this.progress);
		var offset_y = dy + this.lineHeight / 2;
		for (var i = 0; i < this.lines.length; i++) {
			if (chars < this.lines[i].length) {
				surface.fillText(this.lines[i].substr(0, chars) + (Math.round(this.progress / this.speed * 0.4) % 2 == 0 ? "_" : ""), dx, offset_y);
				break;
			} else {
				surface.fillText(this.lines[i], dx, offset_y);
				chars -= this.lines[i].length;
				offset_y += this.lineHeight + this.hOffset;
			}
		}
		surface.restore();
	}

	TextLineRender.prototype.tick = function () {
		if (this.running) {
			this.progress += this.speed + (Math.random() * this.random - this.random / 2);
			var totalProgress = 0;
			for (var i = 0; i < this.lines.length; i++) {
				totalProgress += this.lines[i].length;
			}
			if (this.progress > totalProgress) {
				this.done.do();
			}
		}
	}

	function RectHeaderRender(rect, label, speed, color) {
		this.rect = rect;
		this.label = label;
		this.running = false;
		this.progress = 0;
		this.speed = speed;
		this.color = color;
		this.finish = false;
		this.done = new Channel(1, null);
	}

	// print rect with text as header
	RectHeaderRender.prototype.start = function () {
		this.running = true;
	}

	RectHeaderRender.prototype.stop = function () {
		this.running = false;
	}

	RectHeaderRender.prototype.reset = function () {
		this.progress = 0;
		this.finish = false;
		this.running = false;
		this.done.reset();
	}

	RectHeaderRender.prototype.restart = function () {
		this.progress = 0;
		this.finish = false;
		this.running = true;
		this.done.reset();
	}

	RectHeaderRender.prototype.draw = function (surface) {
		if (!this.running) {
			return;
		}
		surface.save();
		var rect = {
			x: this.rect.x * overlay.width,
			y: this.rect.y * overlay.height,
			width: this.rect.width * overlay.width,
			height: this.rect.height * overlay.height
		};
		surface.font = "24px Iceland";
		var min_width = Math.max(rect.width, surface.measureText(this.label).width + 6);
		var min_height = Math.max(rect.height, 30);
		if (min_width > rect.width)
			min_height = min_height * min_width / rect.width;
		rect.x -= Math.round((min_width - rect.width) / 2);
		rect.y -= Math.round((min_height - rect.height) / 2);
		rect.width = min_width;
		rect.height = min_height;
		var totalLength = (rect.width + rect.height) * 2;
		var progress = this.progress;
		surface.lineWidth = 3;
		surface.strokeStyle = this.color;
		surface.beginPath();
		surface.moveTo(rect.x + rect.width, rect.y);
		surface.lineTo(rect.x + rect.width, rect.y + Math.min(rect.height, progress));
		if (progress >= rect.height) {
			surface.lineTo(rect.x + rect.width - Math.min(rect.width, progress - rect.height), rect.y + rect.height);
		}
		if (progress >= rect.width + rect.height) {
			surface.lineTo(rect.x, rect.y + rect.height - Math.min(rect.height, progress - rect.height - rect.width));
		}
		surface.stroke();
		surface.strokeStyle = null;
		surface.fillStyle = this.color;
		if (progress >= rect.width + rect.height * 2) {
			surface.fillRect(rect.x, rect.y, Math.min(rect.width, progress - rect.width - rect.height * 2), 23);
		}
		if (progress >= (rect.width + rect.height) * 2) {
			surface.fillStyle = "#ffffff";
			surface.font = "24px Iceland";
			var length = (this.progress - totalLength) * 0.03;
			if (length < this.label.length - 1)
				surface.fillText(this.label.substr(0, Math.round(length)) + (Math.round(this.progress * 0.05) % 2 == 0 ? "_" : ""), rect.x + 3, rect.y + 18);
			else {
				surface.fillText(this.label, rect.x + 3, rect.y + 18);
				this.finish = true;
			}
		}
		surface.restore();
	}

	RectHeaderRender.prototype.setDone = function (done) {
		this.done.setDone(done);
	}

	RectHeaderRender.prototype.tick = function () {
		if (this.running) {
			this.progress += this.speed;
			if (this.finish) {
				this.done.do();
			}
		}
	}

	// print rect with text as flag
	function RectFlagRender(rect, label, speed, color) {
		this.rect = rect;
		this.label = label;
		this.running = false;
		this.progress = 0;
		this.speed = speed;
		this.color = color;
		this.finish = false;
		this.done = new Channel(1, null);
	}

	RectFlagRender.prototype.start = function () {
		this.running = true;
	}

	RectFlagRender.prototype.stop = function () {
		this.running = false;
	}

	RectFlagRender.prototype.reset = function () {
		this.progress = 0;
		this.finish = false;
		this.running = false;
		this.done.reset();
	}

	RectFlagRender.prototype.restart = function () {
		this.progress = 0;
		this.finish = false;
		this.running = true;
		this.done.reset();
	}

	RectFlagRender.prototype.draw = function (surface) {
		if (!this.running) {
			return;
		}
		surface.save();
		var rect = {
			x: this.rect.x * overlay.width,
			y: this.rect.y * overlay.height,
			width: this.rect.width * overlay.width,
			height: this.rect.height * overlay.height
		};
		surface.font = "24px Iceland";
		var textWidth = surface.measureText(this.label).width + 6;
		var totalLength = (rect.width + rect.height) * 2;
		var progress = this.progress;
		surface.lineWidth = 3;
		surface.strokeStyle = this.color;
		surface.beginPath();
		surface.moveTo(rect.x, rect.y);
		surface.lineTo(rect.x + Math.min(rect.width, progress), rect.y);
		if (progress >= rect.width) {
			surface.lineTo(rect.x + rect.width, rect.y + Math.min(rect.height, progress - rect.width));
		}
		if (progress >= rect.width + rect.height) {
			surface.lineTo(rect.x + rect.width - Math.min(rect.width, progress - rect.width - rect.height), rect.y + rect.height);
		}
		if (progress >= rect.width * 2 + rect.height) {
			surface.lineTo(rect.x, rect.y + rect.height - Math.min(rect.height, progress - rect.width * 2 - rect.height));
		}
		if (progress >= (rect.width + rect.height) * 2) {
			progress -= (rect.width + rect.height) * 2;
			surface.lineTo(rect.x, rect.y - Math.min(progress, 30));
			surface.stroke();
			if (progress >= 30) {
				surface.strokeStyle = null;
				surface.fillStyle = this.color;
				surface.fillRect(rect.x, rect.y - 30, Math.min(textWidth, progress - 30), 23);
				if (progress >= textWidth) {
					surface.fillStyle = "#ffffff";
					surface.font = "24px Iceland";
					var length = (progress - 30 - textWidth) * 0.03;
					if (length < this.label.length - 1)
						surface.fillText(this.label.substr(0, Math.round(length)) + (Math.round(progress * 0.05) % 2 == 0 ? "_" : ""), rect.x + 3, rect.y - 30 + 18);
					else {
						surface.fillText(this.label, rect.x + 3, rect.y - 30 + 18);
						this.finish = true;
					}
				}
			}
		} else {
			surface.stroke();
		}
		surface.restore();
	}

	RectFlagRender.prototype.setDone = function (done) {
		this.done.setDone(done);
	}

	RectFlagRender.prototype.tick = function () {
		if (this.running) {
			this.progress += this.speed;
			if (this.finish) {
				this.done.do();
			}
		}
	}

	/* load image, and draw it to canvas */
	var overlay = document.getElementById("overlay");
	var surface = overlay.getContext("2d");

	var docomputersdream = new TextLineRender(["DO", "COMPUTERS", "DREAM?", "ZzzZzzz"], 0.2, 0.2, "red", "40px Iceland", 40, 10);
	var dropSomething = new TextLineRender(["DRAG AND DROP A PHOTO", "SHARE WITH EVERYONE", "AND LET COMPUTER DREAM", "HTTP://GITHUB.COM/LIULIU/DOCOMPUTERSDREAM"], 0.2, 0.2, "red", "20px Iceland", 20, 3);

	var dreamDejavu = new Channel(2, function () {
		// this can be fired before the result is back
		if (classify) {
			classify.start();
		}
		if (rects.length > 0) {
			rects[0].start();
		}
		docomputersdream.stop();
	});

	docomputersdream.setDone(function () {
		dreamDejavu.do();
	});

	var classify = null;
	var rects = [];
	var canvasOpacity = 0;

	function render() {
		if (image && image.src) {
			// only draws if we have image
			surface.clearRect(0, 0, overlay.width, overlay.height);
			for (var i = 0; i < rects.length; i++) {
				rects[i].draw(surface);
			}
			docomputersdream.draw(surface, 20, 25);
			dropSomething.draw(surface, 22, overlay.height - 100);
			if (classify) {
				classify.draw(surface, 20, 25);
			}
			if (classify && classify.running && canvasOpacity < 1) {
				canvasOpacity += 0.005;
				document.getElementById("output").style.opacity = canvasOpacity * canvasOpacity;
			}
			// making progress now
			for (var i = 0; i < rects.length; i++) {
				rects[i].tick();
			}
			docomputersdream.tick();
			dropSomething.tick();
			if (classify) {
				classify.tick();
			}
		}
	}

	setInterval(render, 50);

	var image = null;

	function resizeViewport(naturalWidth, naturalHeight) {
		var blur = document.getElementById("blur");
		var canvas = document.getElementById("output");
		var viewport = document.getElementById("viewport");
		var boundingWidth = document.getElementById("content").offsetWidth - 80;
		var boundingHeight = window.innerHeight - 120;
		var newWidth = naturalWidth, newHeight = naturalHeight;
		if (naturalWidth * boundingHeight > boundingWidth * naturalHeight) {
			newWidth = boundingWidth;
			newHeight = Math.round(boundingWidth * naturalHeight / naturalWidth);
		} else {
			newHeight = boundingHeight;
			newWidth = Math.round(boundingHeight * naturalWidth / naturalHeight);
		}
		viewport.style.width = newWidth.toString() + "px";
		viewport.style.height = newHeight.toString() + "px";
		viewport.style.marginLeft = (-newWidth / 2).toString() + "px";
		viewport.style.marginTop = (-newHeight / 2 - 10).toString() + "px";
		viewport.style.background = null;
		overlay.width = canvas.width = blur.width = newWidth;
		overlay.style.width = canvas.style.width = blur.style.width = newWidth.toString() + "px";
		overlay.height = canvas.height = blur.height = newHeight;
		overlay.style.height = canvas.style.height = blur.style.height = newHeight.toString() + "px";
		return {
			width: newWidth,
			height: newHeight
		}
	}

	function detectSubsampling(img) {
		var iw = img.naturalWidth, ih = img.naturalHeight;
		if (iw * ih > 1024 * 1024) { // subsampling may happen over megapixel image
			var canvas = document.createElement('canvas');
			canvas.width = canvas.height = 1;
			var ctx = canvas.getContext('2d');
			ctx.drawImage(img, -iw + 1, 0);
			// subsampled image becomes half smaller in rendering size.
			// check alpha channel value to confirm image is covering edge pixel or not.
			// if alpha value is 0 image is not covering, hence subsampled.
			return ctx.getImageData(0, 0, 1, 1).data[3] === 0;
		} else {
			return false;
		}
	}

	function redraw(image) {
		var blur = document.getElementById("blur");
		var canvas = document.getElementById("output");
		var ctx = canvas.getContext("2d");
		var newSize = resizeViewport(image.naturalWidth, image.naturalHeight);
		var newWidth = newSize.width, newHeight = newSize.height;
		// tiling the image to avoid bug on iPad for larger than 2M image
		var subsampling = detectSubsampling(image);
		var tileWidth = Math.ceil(newWidth / 4), tileHeight = Math.ceil(newHeight / 4);
		var tileNaturalWidth = Math.ceil(image.naturalWidth / (subsampling ? 8 : 4)), tileNaturalHeight = Math.ceil(image.naturalHeight / (subsampling ? 8 : 4));
		for (var x = 0; x < 4; x++) {
			var residualWidth = Math.min(tileWidth, newWidth - tileWidth * x);
			var naturalWidth = Math.min(tileNaturalWidth, image.naturalWidth / (subsampling ? 2 : 1) - tileNaturalWidth * x);
			for (var y = 0; y < 4; y++) {
				var residualHeight = Math.min(tileHeight, newHeight - tileHeight * y);
				var naturalHeight = Math.min(tileNaturalHeight, image.naturalHeight / (subsampling ? 2 : 1) - tileNaturalHeight * y);
				ctx.drawImage(image, tileNaturalWidth * x, tileNaturalHeight * y, naturalWidth, naturalHeight, tileWidth * x, tileHeight * y, residualWidth, residualHeight);
				blur.getContext("2d").drawImage(image, tileNaturalWidth * x, tileNaturalHeight * y, naturalWidth, naturalHeight, tileWidth * x, tileHeight * y, residualWidth, residualHeight);
			}
		}
		stackBlurCanvasRGBA("blur", 0, 0, newWidth, newHeight, 10);
		canvas.style.opacity = canvasOpacity = 0;

		// blur the image to the full window
		var background = document.getElementById("background");
		var bctx = background.getContext("2d");
		background.width = window.innerWidth;
		background.height =window.innerHeight;
		var fillWidth = image.naturalWidth, fillHeight = image.naturalHeight;
		if (image.naturalWidth * window.innerHeight > window.innerWidth * image.naturalHeight) {
			fillHeight = image.naturalHeight;
			fillWidth = window.innerWidth * image.naturalHeight / window.innerHeight;
		} else {
			fillWidth = image.naturalWidth;
			fillHeight = window.innerHeight * image.naturalWidth / window.innerWidth;
		}
		if (subsampling) {
			fillWidth = fillWidth / 2;
			fillHeight = fillHeight / 2;
		}
		tileWidth = Math.ceil(window.innerWidth / 4), tileHeight = Math.ceil(window.innerHeight / 4);
		tileNaturalWidth = Math.ceil(fillWidth / 4), tileNaturalHeight = Math.ceil(fillHeight / 4);
		for (var x = 0; x < 4; x++) {
			var residualWidth = Math.min(tileWidth, window.innerWidth - tileWidth * x);
			var naturalWidth = Math.min(tileNaturalWidth, fillWidth - tileNaturalWidth * x);
			for (var y = 0; y < 4; y++) {
				var residualHeight = Math.min(tileHeight, window.innerHeight - tileHeight * y);
				var naturalHeight = Math.min(tileNaturalHeight, fillHeight - tileNaturalHeight * y);
				bctx.drawImage(image, (image.naturalWidth / (subsampling ? 2 : 1) - fillWidth) / 2 + tileNaturalWidth * x, (image.naturalHeight / (subsampling ? 2 : 1) - fillHeight) / 2 + tileNaturalHeight * y, tileNaturalWidth, tileNaturalHeight, tileWidth * x, tileHeight * y, residualWidth, residualHeight);
			}
		}
		stackBlurCanvasRGBA("background", 0, 0, window.innerWidth, window.innerHeight, 8);
	}

	function imageReload() {
		docomputersdream.restart();
		redraw(image);
	};

	function parseDream(response) {
		var lines = [];
		for (var i = 0; i < response.classify.length; i++) {
			var words = response.classify[i].word.split(",");
			lines.push(words[0].toUpperCase());
		}
		classify = new TextLineRender(lines, 0.2, 0.2, "blue", "40px Iceland", 40, 10);
		classify.setDone(function () {
			dropSomething.start();
		});
		for (var i = 0; i < response.face.length; i++) {
			if (response.face[i].width * overlay.width * response.face[i].height * overlay.height > 40 * 40) {
				var rect = new RectHeaderRender(response.face[i], "A Face", 12, "rgba(0,255,0,0.7)");
				rects.push(rect);
			}
		}
		for (var i = 0; i < response.car.length; i++) {
			if (response.car[i].width * overlay.width * response.car[i].height * overlay.height > 120 * 60) {
				var rect = new RectHeaderRender(response.car[i], "A Car", 12, "rgba(255,255,0,0.7)");
				rects.push(rect);
			}
		}
		for (var i = 0; i < response.pedestrian.length; i++) {
			var rect = new RectFlagRender(response.pedestrian[i], "Person", 12, "rgba(0,255,128,0.7)");
			rects.push(rect);
		}
		for (var i = 0; i < response.word.length; i++) {
			if (response.word[i].width * overlay.width * response.word[i].height * overlay.height > 40 * 20 && response.word[i].word.trim().length > 0) {
				var rect = new RectFlagRender(response.word[i], response.word[i].word, 12, "rgba(255,128,0,0.7)");
				rects.push(rect);
			}
		}
		shuffle(rects);
		for (var i = 0; i < rects.length - 1; i++) {
			(function (i) {
				rects[i].setDone(function () {
					rects[i + 1].start();
				});
			})(i);
		}
		dreamDejavu.do();
	}

	function dreamRemotely(file) {
		classify = null;
		rects = [];
		var formData = new FormData();
		formData.append("source", file);
		var request = new XMLHttpRequest();
		request.open("POST", "/api/ccv");
		request.onload = function () {
			var response = JSON.parse(this.responseText);
			image.url = response.url;
			parseDream(response.meta);
		};
		request.send(formData);
	}

	function dropFile(file) {
		if (file.type.match(/image.*/)) {
			var reader = new FileReader();
			reader.onload = function (e) {
				image = new Image();
				image.onload = imageReload;
				image.src = e.target.result;
			};
			reader.readAsDataURL(file);
			dreamDejavu.reset();
			dropSomething.reset();
			dreamRemotely(file);
		}
	}

	document.addEventListener("dragover", function (e) {
		e.stopPropagation();
		e.preventDefault();
	}, false);

	document.addEventListener("drop", function (e) {
		e.stopPropagation();
		e.preventDefault();

		var files = e.dataTransfer.files;

		if (files.length)
			dropFile(files[0]);
	}, false);

	document.getElementById("overlay").addEventListener("click", function (e) {
		if (e.clientY > document.getElementById("overlay").height - 110) {
			window.open("http://github.com/liuliu/docomputersdream");
		}
	});

	window.addEventListener("resize", function (e) {
		if (image) {
			redraw(image);
			dreamDejavu.reset();
			if (classify) {
				classify.reset();
				dreamDejavu.do();
			}
			for (var i = 0; i < rects.length; i++) {
				rects[i].reset();
			}
			dropSomething.reset();
			document.getElementById("output").style.opacity = canvasOpacity = 0;
			docomputersdream.restart();
		} else {
			resizeViewport(640, 480);
		}
	});

	resizeViewport(640, 480);

	docomputersdream.restart();

	var timeoutID;

	dropSomething.setDone(function () {
		if (timeoutID) {
			window.clearTimeout(timeoutID);
		}
		timeoutID = window.setTimeout(function () {
			ptail();
		}, 8000);
	});

	// load the dream from server
	function ptail() {
		var request = new XMLHttpRequest();
		request.open("GET", "/api/latest");
		request.onload = function () {
			if (this.responseText && this.responseText.length > 0) {
				var response = JSON.parse(this.responseText);
				if (!image || response.url != image.url) {
					dreamDejavu.reset();
					dropSomething.reset();
					classify = null;
					rects = [];
					image = new Image();
					image.crossOrigin = "Anonymous";
					image.onload = function () {
						imageReload();
						parseDream(response.meta);
					}
					image.url = image.src = response.url;
				}
			}
		};
		request.send();
	}

	ptail();
})();
