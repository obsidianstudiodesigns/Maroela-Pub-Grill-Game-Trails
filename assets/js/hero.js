/* Hero scene: the real farm photo rendered through WebGL so the bushveld feels alive.
   - slow push-in (Ken Burns) with pointer depth parallax: the ground moves more than the hills
   - cloud shadows drifting across the veld, heat shimmer along the treeline
   - golden-hour grade with a low sun glow and soft light shafts
   - a separate 2D canvas adds dust motes and out-of-focus pollen catching the light
   Falls back to the plain <img> with a CSS Ken Burns when WebGL or motion is unavailable. */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hero = document.querySelector(".hero");
  var canvas = document.querySelector("[data-hero-gl]");
  var dustCanvas = document.querySelector("[data-hero-dust]");
  var img = document.querySelector("[data-hero-img]");
  if (!hero || !canvas || !img) return;

  function heroReady() {
    if (window.__heroReady) return;
    window.__heroReady = true;
    document.dispatchEvent(new CustomEvent("hero:ready"));
  }

  var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  var visible = true;
  var start = performance.now();

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  }
  if (!reduce && window.matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      pointer.tx = (e.clientX - r.left) / r.width * 2 - 1;
      pointer.ty = (e.clientY - r.top) / r.height * 2 - 1;
    });
    hero.addEventListener("pointerleave", function () { pointer.tx = 0; pointer.ty = 0; });
  }
  // gentle device tilt on phones, only when the browser allows it without a prompt
  if (!reduce && window.matchMedia("(pointer: coarse)").matches && "DeviceOrientationEvent" in window && typeof DeviceOrientationEvent.requestPermission !== "function") {
    window.addEventListener("deviceorientation", function (e) {
      if (e.gamma == null) return;
      pointer.tx = Math.max(-1, Math.min(1, e.gamma / 25));
      pointer.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
    });
  }

  /* ---------------- WebGL photo scene ---------------- */
  var VERT = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}";
  var FRAG = [
    "precision highp float;",
    "varying vec2 v;",
    "uniform sampler2D tex;",
    "uniform vec2 res, imgRes, mouse;",
    "uniform float t, intro;",
    "float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
    "float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
    " return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}",
    "float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}",
    "void main(){",
    "  vec2 uv=v;",
    // cover-fit the photo
    "  float rs=res.x/res.y, ri=imgRes.x/imgRes.y;",
    "  vec2 sc=rs>ri?vec2(1.,ri/rs):vec2(rs/ri,1.);",
    "  uv=(uv-.5)*sc+.5;",
    // slow breathing push-in, starts wider during the intro
    "  float z=1.025+.02*sin(t*.045)-.05*(1.-intro);",
    "  uv=(uv-vec2(.52,.42))/z+vec2(.52,.42);",
    // depth parallax: lower part of the frame (foreground) shifts more
    "  float depth=mix(1.,.15,smoothstep(.0,.75,v.y));",
    "  uv+=mouse*vec2(.016,.010)*depth;",
    // heat shimmer along the treeline band
    "  float band=smoothstep(.30,.42,v.y)*(1.-smoothstep(.50,.62,v.y));",
    "  uv.x+=(fbm(vec2(uv.x*14.,uv.y*60.-t*1.1))-.5)*.0026*band;",
    "  uv.y+=(fbm(vec2(uv.x*10.+t*.3,uv.y*40.))-.5)*.0012*band;",
    // grass sway in the foreground
    "  float fg=1.-smoothstep(.0,.30,v.y);",
    "  uv.x+=sin(uv.y*90.+t*1.6+fbm(uv*6.+t*.2)*6.)*.0007*fg;",
    "  vec3 c=texture2D(tex,clamp(uv,.001,.999)).rgb;",
    // cloud shadows sliding over the land
    "  float land=1.-smoothstep(.60,.80,v.y);",
    "  float cl=fbm(vec2(uv.x*2.2-t*.018,uv.y*3.4+t*.006));",
    "  c*=1.-.16*smoothstep(.5,.74,cl)*land;",
    // golden hour grade
    "  float l=dot(c,vec3(.299,.587,.114));",
    "  c=mix(c,vec3(l),.04);",
    "  c*=vec3(1.07,1.0,.90);",
    "  c=pow(c,vec3(.97,.99,1.04))*1.04;",
    // low sun from the upper right, soft shafts
    "  vec2 sp=vec2(.86+.02*sin(t*.03),.92);",
    "  vec2 d=(v-sp)*vec2(rs,1.);",
    "  float g=exp(-length(d)*2.8);",
    "  float ang=atan(d.y,d.x);",
    "  float rays=pow(fbm(vec2(ang*7.,t*.05)),2.)*exp(-length(d)*1.1);",
    "  c+=vec3(1.,.66,.32)*(g*.46+rays*.16);",
    "  c=1.-(1.-c)*(1.-vec3(1.,.72,.42)*g*.18);",
    // haze lifting from the valley floor
    "  c=mix(c,vec3(.96,.82,.62),.05*smoothstep(.4,.8,v.y));",
    // vignette and fine grain
    "  vec2 q=v-.5;c*=1.-.38*dot(q*vec2(1.1,1.3),q*vec2(1.1,1.3));",
    "  c+=(h(v*res+fract(t))-.5)*.035;",
    "  c=mix(vec3(.93,.94,.886),c,intro);",
    "  gl_FragColor=vec4(c,1.);",
    "}"
  ].join("\n");

  var gl = null, prog, loc = {}, texReady = false, introStart = 0;
  if (!reduce) {
    try { gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" }); } catch (e) { gl = null; }
  }

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }

  function sizeGL() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  }

  function loadTexture(src) {
    var im = new Image();
    im.decoding = "async";
    im.onload = function () {
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform2f(loc.imgRes, im.naturalWidth, im.naturalHeight);
      texReady = true;
      introStart = performance.now();
      hero.classList.add("has-gl");
      heroReady();
    };
    im.onerror = function () { gl = null; heroReady(); };
    im.src = src;
  }

  if (gl) {
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      var pa = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(pa);
      gl.vertexAttribPointer(pa, 2, gl.FLOAT, false, 0, 0);
      ["res", "imgRes", "mouse", "t", "intro"].forEach(function (k) { loc[k] = gl.getUniformLocation(prog, k); });
      sizeGL();
      // the <picture> already chose the right crop for this viewport
      loadTexture(img.currentSrc || img.src);
    } catch (err) {
      gl = null;
    }
  }
  if (!gl) {
    // still let the page intro run if the image is cached or slow
    if (img.complete) heroReady();
    else img.addEventListener("load", function () { heroReady(); }, { once: true });
  }

  /* ---------------- dust and pollen ---------------- */
  var dctx = dustCanvas && !reduce ? dustCanvas.getContext("2d") : null;
  var motes = [];
  var dW = 0, dH = 0, dDpr = 1;

  function sizeDust() {
    dDpr = Math.min(window.devicePixelRatio || 1, 2);
    dW = dustCanvas.clientWidth; dH = dustCanvas.clientHeight;
    dustCanvas.width = Math.round(dW * dDpr); dustCanvas.height = Math.round(dH * dDpr);
    dctx.setTransform(dDpr, 0, 0, dDpr, 0, 0);
    var count = Math.round(Math.min(110, Math.max(40, dW * dH / 16000)));
    motes = [];
    for (var i = 0; i < count; i++) motes.push(makeMote(true));
  }

  function makeMote(anywhere) {
    var bokeh = Math.random() < 0.12;
    return {
      x: Math.random() * dW,
      y: anywhere ? Math.random() * dH : dH + 20,
      z: bokeh ? 1 : Math.random() * 0.8 + 0.2,
      r: bokeh ? 10 + Math.random() * 22 : 0.5 + Math.random() * 1.8,
      a: bokeh ? 0.05 + Math.random() * 0.07 : 0.25 + Math.random() * 0.55,
      vx: (Math.random() * 0.25 + 0.05),
      vy: -(Math.random() * 0.22 + 0.04),
      ph: Math.random() * Math.PI * 2,
      bokeh: bokeh
    };
  }

  function drawDust(time) {
    dctx.clearRect(0, 0, dW, dH);
    var sunX = dW * 0.86, sunY = dH * 0.08;
    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      var wind = Math.sin(time * 0.0003 + m.ph) * 0.35 + 0.25;
      m.x += (m.vx + wind) * m.z;
      m.y += m.vy * m.z + Math.sin(time * 0.001 + m.ph) * 0.12;
      if (m.x > dW + 40 || m.y < -40) { motes[i] = makeMote(false); motes[i].x = Math.random() * dW * 0.9 - 40; continue; }
      // motes sparkle when they drift through the light from the sun
      var dx = m.x - sunX, dy = m.y - sunY;
      var lit = Math.exp(-Math.sqrt(dx * dx + dy * dy) / (dW * 0.55));
      var twinkle = 0.65 + 0.35 * Math.sin(time * 0.002 + m.ph * 3);
      var px = m.x + pointer.x * 22 * m.z, py = m.y + pointer.y * 12 * m.z;
      var alpha = m.a * (0.35 + lit * 1.2) * twinkle;
      if (m.bokeh) {
        var g = dctx.createRadialGradient(px, py, 0, px, py, m.r);
        g.addColorStop(0, "rgba(255,214,150," + alpha + ")");
        g.addColorStop(0.7, "rgba(255,190,110," + alpha * 0.55 + ")");
        g.addColorStop(1, "rgba(255,180,100,0)");
        dctx.fillStyle = g;
        dctx.beginPath(); dctx.arc(px, py, m.r, 0, Math.PI * 2); dctx.fill();
      } else {
        dctx.fillStyle = "rgba(255,226,170," + alpha + ")";
        dctx.beginPath(); dctx.arc(px, py, m.r, 0, Math.PI * 2); dctx.fill();
      }
    }
  }

  if (dctx) sizeDust();

  /* ---------------- loop ---------------- */
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible || document.hidden) return;
    pointer.x += (pointer.tx - pointer.x) * 0.04;
    pointer.y += (pointer.ty - pointer.y) * 0.04;
    if (gl && texReady) {
      var t = (now - start) / 1000;
      var intro = Math.min(1, (now - introStart) / 2200);
      intro = 1 - Math.pow(1 - intro, 3);
      gl.uniform2f(loc.res, canvas.width, canvas.height);
      gl.uniform2f(loc.mouse, pointer.x, -pointer.y);
      gl.uniform1f(loc.t, t);
      gl.uniform1f(loc.intro, intro);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (dctx) drawDust(now);
  }
  if (gl || dctx) requestAnimationFrame(frame);

  var rz;
  window.addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (gl) sizeGL();
      if (dctx) sizeDust();
    }, 150);
  });
})();
