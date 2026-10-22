(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ---------------- smooth scroll ---------------- */
  var lenis = null;
  if (!reduce && window.Lenis && hasGsap) {
    lenis = new Lenis({ duration: 1.15, easing: function (t) { return 1 - Math.pow(1 - t, 4); } });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  function scrollToTarget(target) {
    var nav = $("[data-nav]");
    var offset = target.id === "top" ? 0 : -(nav ? nav.offsetHeight : 0) + 1;
    if (lenis) lenis.scrollTo(target, { offset: offset, duration: 1.5 });
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.pageYOffset + offset, behavior: reduce ? "auto" : "smooth" });
  }

  /* ---------------- split helpers ---------------- */
  function splitWords(el, cls) {
    var out = [];
    var nodes = Array.prototype.slice.call(el.childNodes);
    el.innerHTML = "";
    nodes.forEach(function (node) {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(" ")); return; }
          var outer = document.createElement("span");
          outer.className = cls;
          var inner = document.createElement("span");
          inner.textContent = part;
          outer.appendChild(inner);
          el.appendChild(outer);
          out.push(inner);
        });
      } else {
        var o = document.createElement("span");
        o.className = cls;
        var i = document.createElement("span");
        i.appendChild(node);
        o.appendChild(i);
        el.appendChild(o);
        out.push(i);
      }
    });
    return out;
  }

  /* ---------------- intro ---------------- */
  var loader = $(".loader");
  var introDone = false;
  function runIntro() {
    if (introDone) return;
    introDone = true;
    if (!hasGsap || reduce) {
      if (loader) loader.remove();
      return;
    }
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.to(".loader__logo", { y: -12, opacity: 0, duration: 0.6, ease: "power2.in" })
      .to(".loader__bar", { opacity: 0, duration: 0.3 }, "<")
      .to(loader, { clipPath: "inset(0 0 100% 0)", duration: 1.1, ease: "expo.inOut", onComplete: function () { loader.remove(); } }, "-=0.15")
      .from(".hero__title .line > span", { yPercent: 115, rotate: 2, duration: 1.5, stagger: 0.12 }, "-=0.55")
      .from("[data-hero-fade]", { y: 26, opacity: 0, duration: 1.2, stagger: 0.12 }, "-=1.1")
      .from(".nav", { opacity: 0, duration: 1, clearProps: "opacity" }, "-=1.2");
  }
  if (window.__heroReady) runIntro();
  else document.addEventListener("hero:ready", runIntro, { once: true });
  setTimeout(runIntro, 2800);

  /* ---------------- nav ---------------- */
  var nav = $("[data-nav]");
  var lastY = 0;
  function onScroll(y) {
    if (!nav) return;
    nav.classList.toggle("is-scrolled", y > 40);
    var menuOpen = document.body.classList.contains("is-locked");
    if (!menuOpen) nav.classList.toggle("is-hidden", y > lastY && y > window.innerHeight * 0.6);
    lastY = y;
    var wa = $(".wa-float");
    if (wa) wa.classList.toggle("is-in", y > window.innerHeight * 0.5);
  }
  if (lenis) lenis.on("scroll", function (e) { onScroll(e.scroll); });
  else if (hasGsap) ScrollTrigger.create({ start: 0, end: "max", onUpdate: function (self) { onScroll(self.scroll()); } });
  onScroll(window.pageYOffset);

  // highlight the section in view
  if (hasGsap) {
    $$(".nav__links a").forEach(function (a) {
      var sec = $(a.getAttribute("href"));
      if (!sec) return;
      ScrollTrigger.create({
        trigger: sec, start: "top 45%", end: "bottom 45%",
        onToggle: function (self) { a.classList.toggle("is-active", self.isActive); }
      });
    });
  }

  /* ---------------- mobile menu ---------------- */
  var menu = $("[data-menu]");
  var toggle = $("[data-menu-toggle]");
  function setMenu(open) {
    if (!menu || !toggle) return;
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", open ? "false" : "true");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("is-locked", open);
    if (open) { nav.classList.remove("is-hidden"); lenis && lenis.stop(); }
    else { lenis && lenis.start(); }
  }
  if (toggle) toggle.addEventListener("click", function () { setMenu(!menu.classList.contains("is-open")); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu && menu.classList.contains("is-open")) setMenu(false); });

  /* ---------------- anchors ---------------- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener("click", function (e) {
      var id = a.getAttribute("href");
      if (id.length < 2) return;
      var target = $(id);
      if (!target) return;
      e.preventDefault();
      var preset = a.getAttribute("data-book");
      if (preset) setBookingType(preset);
      if (menu && menu.classList.contains("is-open")) {
        setMenu(false);
        setTimeout(function () { scrollToTarget(target); }, 380);
      } else {
        scrollToTarget(target);
      }
    });
  });

  /* ---------------- magnetic buttons ---------------- */
  if (finePointer && !reduce) {
    $$("[data-magnetic]").forEach(function (btn) {
      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        btn.style.setProperty("--bx", ((e.clientX - r.left) / r.width - 0.5) * 10 + "px");
        btn.style.setProperty("--by", ((e.clientY - r.top) / r.height - 0.5) * 8 + "px");
      });
      btn.addEventListener("pointerleave", function () {
        btn.style.setProperty("--bx", "0px");
        btn.style.setProperty("--by", "0px");
      });
    });
  }

  /* ---------------- scroll reveals ---------------- */
  if (hasGsap && !reduce) {
    $$("[data-split]").forEach(function (h) {
      var words = splitWords(h, "sw");
      gsap.from(words, {
        yPercent: 110, rotate: 3, duration: 1.2, ease: "expo.out", stagger: 0.05,
        scrollTrigger: { trigger: h, start: "top 85%", once: true }
      });
    });

    ScrollTrigger.batch("[data-reveal]", {
      start: "top 88%", once: true,
      onEnter: function (els) { gsap.fromTo(els, { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: "expo.out", stagger: 0.1, overwrite: true }); }
    });
    gsap.set("[data-reveal]", { opacity: 0 });

    $$("[data-reveal-list]").forEach(function (list) {
      gsap.from(list.children, {
        y: 24, opacity: 0, duration: 1, ease: "expo.out", stagger: 0.07,
        scrollTrigger: { trigger: list, start: "top 85%", once: true }
      });
    });

    $$("[data-clip]").forEach(function (el) {
      var im = el.querySelector("img, iframe");
      gsap.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, {
        clipPath: "inset(0% 0% 0% 0%)", duration: 1.6, ease: "expo.inOut",
        scrollTrigger: { trigger: el, start: "top 82%", once: true }
      });
      if (im && !im.hasAttribute("data-parallax") && im.tagName === "IMG") {
        gsap.fromTo(im, { scale: 1.3 }, { scale: 1, duration: 2, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 82%", once: true } });
      }
    });

    $$("[data-parallax]").forEach(function (im) {
      var amt = parseFloat(im.getAttribute("data-parallax")) || -8;
      gsap.fromTo(im, { yPercent: -amt }, {
        yPercent: amt, ease: "none",
        scrollTrigger: { trigger: im.closest("figure") || im, start: "top bottom", end: "bottom top", scrub: true }
      });
    });

    // manifesto: words light up as you read down the page
    var manifesto = $("[data-words]");
    if (manifesto) {
      var words = [];
      var text = manifesto.textContent.trim();
      manifesto.textContent = "";
      text.split(/\s+/).forEach(function (w, i, arr) {
        var s = document.createElement("span");
        s.className = "w";
        s.textContent = w;
        manifesto.appendChild(s);
        if (i < arr.length - 1) manifesto.appendChild(document.createTextNode(" "));
        words.push(s);
      });
      ScrollTrigger.create({
        trigger: manifesto, start: "top 78%", end: "bottom 42%", scrub: true,
        onUpdate: function (self) {
          var lit = Math.round(self.progress * words.length);
          for (var i = 0; i < words.length; i++) words[i].style.opacity = i < lit ? 1 : 0.16;
        }
      });
    }

    // hero content drifts and fades as the next section arrives
    gsap.to(".hero__content", {
      yPercent: -18, opacity: 0, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 20%", scrub: true }
    });
    gsap.to("[data-hero-media]", {
      yPercent: 14, ease: "none",
      scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true }
    });
  } else {
    $$("[data-words] , [data-reveal]").forEach(function (el) { el.style.opacity = 1; });
  }

  /* ---------------- marquee ---------------- */
  var marquee = $("[data-marquee] .marquee__track");
  if (marquee && hasGsap && !reduce) {
    marquee.innerHTML += marquee.innerHTML;
    var loop = gsap.to(marquee, { xPercent: -50, ease: "none", duration: 46, repeat: -1 });
    ScrollTrigger.create({
      trigger: "[data-marquee]", start: "top bottom", end: "bottom top",
      onUpdate: function (self) {
        var v = self.getVelocity();
        var dir = v < 0 ? -1 : 1;
        gsap.to(loop, { timeScale: dir * (1 + Math.min(Math.abs(v) / 300, 5)), duration: 0.3, overwrite: true });
        gsap.to(loop, { timeScale: dir, duration: 1.4, delay: 0.3, ease: "power2.out" });
      }
    });
  }

  /* ---------------- game drives: horizontal pan on desktop ---------------- */
  if (hasGsap && !reduce) {
    var mm = gsap.matchMedia();
    mm.add("(min-width: 901px)", function () {
      var pin = $("[data-drives]");
      var track = $("[data-drives-track]");
      if (!pin || !track) return;
      var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
      var pan = gsap.to(track, {
        x: function () { return -distance(); },
        ease: "none",
        scrollTrigger: {
          trigger: pin, start: "top top", end: function () { return "+=" + distance(); },
          pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1
        }
      });
      $$(".drive__img img", track).forEach(function (im) {
        gsap.fromTo(im, { xPercent: -6 }, {
          xPercent: 6, ease: "none",
          scrollTrigger: { trigger: im.parentNode, containerAnimation: pan, start: "left right", end: "right left", scrub: true }
        });
      });
    });

    /* ---------------- weddings: zoom parallax ---------------- */
    var zoom = $("[data-zoom]");
    if (zoom) {
      var main = $(".zoom__item--main", zoom);
      var mainImg = $("img", main);
      var others = $$(".zoom__item:not(.zoom__item--main)", zoom);
      var copy = $(".zoom__copy", zoom);
      var coverScale = function () {
        var r = mainImg.getBoundingClientRect();
        var w = r.width / (gsap.getProperty(main, "scale") || 1);
        var h = r.height / (gsap.getProperty(main, "scale") || 1);
        return Math.max(window.innerWidth / w, window.innerHeight / h) * 1.04;
      };
      var ztl = gsap.timeline({
        scrollTrigger: { trigger: zoom, start: "top top", end: "bottom bottom", scrub: 1, invalidateOnRefresh: true }
      });
      ztl.to(main, { scale: function () { return coverScale(); }, ease: "power1.inOut", duration: 1 }, 0);
      ztl.to(mainImg, { borderRadius: 0, duration: 0.6 }, 0.4);
      others.forEach(function (o, i) {
        var s = [5, 6, 5, 7, 8, 9][i % 6];
        ztl.to(o, { scale: s, ease: "power1.in", duration: 1 }, 0);
        ztl.to(o, { opacity: 0, ease: "power1.in", duration: 0.35 }, 0.55);
      });
      ztl.to(copy, { opacity: 1, duration: 0.25 }, 0.78);
      ztl.from($$(".zoom__copy > *", zoom), { y: 40, stagger: 0.05, duration: 0.25 }, 0.78);
    }
  }

  /* ---------------- lightbox ---------------- */
  var lb = $("[data-lightbox]");
  var lbImg = $("[data-lb-img]");
  var items = $$("[data-gallery] a");
  var current = 0;
  function showLb(i) {
    current = (i + items.length) % items.length;
    var a = items[current];
    lbImg.style.opacity = 0;
    lbImg.onload = function () { lbImg.style.opacity = 1; };
    lbImg.src = a.getAttribute("href");
    lbImg.alt = $("img", a).alt;
  }
  function openLb(i) {
    showLb(i);
    lb.classList.add("is-open");
    lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-locked");
    lenis && lenis.stop();
    $("[data-lb-close]").focus();
  }
  function closeLb() {
    lb.classList.remove("is-open");
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-locked");
    lenis && lenis.start();
    items[current] && items[current].focus();
  }
  if (lb) {
    items.forEach(function (a, i) { a.addEventListener("click", function (e) { e.preventDefault(); openLb(i); }); });
    $("[data-lb-close]").addEventListener("click", closeLb);
    $("[data-lb-prev]").addEventListener("click", function () { showLb(current - 1); });
    $("[data-lb-next]").addEventListener("click", function () { showLb(current + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") closeLb();
      if (e.key === "ArrowLeft") showLb(current - 1);
      if (e.key === "ArrowRight") showLb(current + 1);
    });
    var sx = 0;
    lb.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", function (e) {
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) showLb(current + (dx < 0 ? 1 : -1));
    });
  }
  if (hasGsap && !reduce) {
    ScrollTrigger.batch(".m-item", {
      start: "top 92%", once: true,
      onEnter: function (els) { gsap.fromTo(els, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: "expo.out", stagger: 0.08 }); }
    });
    gsap.set(".m-item", { opacity: 0 });
  }

  /* ---------------- booking ---------------- */
  var WA = "27825702637";
  var EMAIL = "admin@maroelagametrails.co.za";
  var form = $("[data-form]");
  var LABELS = { table: "a table", drive: "a game drive", stay: "accommodation", wedding: "a wedding", function: "a function or conference" };

  function setBookingType(type) {
    if (!form) return;
    var r = form.querySelector('input[name="type"][value="' + type + '"]');
    if (r) { r.checked = true; applyType(); }
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function todayISO() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  function applyType() {
    var type = form.querySelector('input[name="type"]:checked').value;
    $$("[data-show]", form).forEach(function (f) {
      f.hidden = f.getAttribute("data-show").split(" ").indexOf(type) === -1;
    });
    var label = $("[data-label-date]", form);
    label.textContent = type === "stay" ? "Check-in" : (type === "wedding" || type === "function") ? "Event date" : "Date";
    var time = $("[data-time]", form);
    var opts = type === "drive" ? ["09:00", "15:00"] : ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
    var prev = time.value;
    time.innerHTML = opts.map(function (o) { return "<option>" + o + "</option>"; }).join("");
    if (opts.indexOf(prev) > -1) time.value = prev;
    else if (type === "table") time.value = "12:00";
    var guests = form.elements.guests;
    if ((type === "wedding" || type === "function") && +guests.value < 10) guests.value = 60;
    if ((type === "table" || type === "drive" || type === "stay") && +guests.value > 40) guests.value = 2;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T12:00:00");
    try { return d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "long", year: "numeric" }); } catch (e) { return iso; }
  }

  function setErr(name, msg) {
    var el = form.elements[name];
    var field = el.closest(".field");
    field.classList.toggle("is-error", !!msg);
    var p = $(".field__err", field);
    if (p) p.textContent = msg || "";
    el.setAttribute("aria-invalid", msg ? "true" : "false");
  }

  function validate(type) {
    var ok = true, first = null;
    function check(name, msg) { setErr(name, msg); if (msg) { ok = false; first = first || form.elements[name]; } }
    var f = form.elements;
    check("name", f.name.value.trim().length < 2 ? "Please tell us your name." : "");
    check("phone", f.phone.value.replace(/\D/g, "").length < 9 ? "Please add a number we can reach you on." : "");
    check("email", f.email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.value) ? "That email address looks incomplete." : "");
    check("date", !f.date.value ? "Please choose a date." : (f.date.value < todayISO() ? "Please choose a date from today onwards." : ""));
    if (type === "stay") check("checkout", !f.checkout.value ? "Please choose a check-out date." : (f.checkout.value <= f.date.value ? "Check-out must be after check-in." : ""));
    else setErr("checkout", "");
    check("guests", !(+f.guests.value >= 1) ? "How many guests?" : "");
    if (first) first.focus();
    return ok;
  }

  function buildMessage(type) {
    var f = form.elements;
    var lines = ["Hi Maroela, I would like to book " + LABELS[type] + "."];
    lines.push("");
    lines.push("Name: " + f.name.value.trim());
    lines.push("Phone: " + f.phone.value.trim());
    if (f.email.value.trim()) lines.push("Email: " + f.email.value.trim());
    if (type === "stay") {
      lines.push("Check-in: " + fmtDate(f.date.value));
      lines.push("Check-out: " + fmtDate(f.checkout.value));
      lines.push("Accommodation: " + f.unit.value);
    } else {
      lines.push((type === "wedding" || type === "function" ? "Event date: " : "Date: ") + fmtDate(f.date.value));
      if (type === "table" || type === "drive") lines.push("Time: " + f.time.value);
    }
    lines.push("Guests: " + f.guests.value);
    if (f.message.value.trim()) { lines.push(""); lines.push(f.message.value.trim()); }
    return lines.join("\n");
  }

  if (form) {
    form.elements.date.min = todayISO();
    form.elements.checkout.min = todayISO();
    applyType();
    $$('input[name="type"]', form).forEach(function (r) { r.addEventListener("change", applyType); });
    form.elements.date.addEventListener("change", function () {
      form.elements.checkout.min = form.elements.date.value || todayISO();
    });
    ["name", "phone", "email", "date", "checkout", "guests"].forEach(function (n) {
      form.elements[n].addEventListener("input", function () { setErr(n, ""); });
    });
    var lastSubmitter = null;
    $$('button[type="submit"]', form).forEach(function (b) { b.addEventListener("click", function () { lastSubmitter = b; }); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var via = (e.submitter || lastSubmitter || {}).value || "whatsapp";
      var type = form.querySelector('input[name="type"]:checked').value;
      var note = $("[data-form-note]");
      note.classList.remove("is-ok");
      if (!validate(type)) { note.textContent = "A few details still need your attention."; return; }
      var msg = buildMessage(type);
      if (via === "email") {
        var subject = "Booking request: " + LABELS[type] + " (" + fmtDate(form.elements.date.value) + ")";
        window.location.href = "mailto:" + EMAIL + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(msg);
        note.textContent = "Your email app should open with the booking ready to send.";
      } else {
        window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(msg), "_blank", "noopener");
        note.textContent = "WhatsApp is opening with your booking ready to send.";
      }
      note.classList.add("is-ok");
    });
  }

  /* ---------------- hours ---------------- */
  var hoursEl = $("[data-hours]");
  if (hoursEl) {
    var HOURS = {
      summer: { 0: [9, 15], 1: null, 2: [9, 23], 3: [9, 23], 4: [9, 23], 5: [9, 23], 6: [9, 23] },
      winter: { 0: [9, 15], 1: null, 2: [11, 19], 3: [11, 19], 4: [11, 19], 5: [9, 21], 6: [9, 21] }
    };
    // trading hours follow South African time wherever the visitor is
    var now = new Date();
    var sa = { month: now.getMonth() + 1, day: now.getDay(), hour: now.getHours() + now.getMinutes() / 60 };
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Johannesburg", month: "numeric", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(now);
      var get = function (t) { var p = parts.filter(function (x) { return x.type === t; })[0]; return p ? p.value : null; };
      var wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
      sa = { month: +get("month"), day: wd, hour: (+get("hour") % 24) + (+get("minute")) / 60 };
    } catch (e) { /* use local time */ }
    var season = sa.month >= 5 && sa.month <= 8 ? "winter" : "summer";
    function showSeason(s) {
      $$("[data-season]", hoursEl).forEach(function (b) { b.setAttribute("aria-selected", b.getAttribute("data-season") === s ? "true" : "false"); });
      $$("[data-season-panel]", hoursEl).forEach(function (p) { p.hidden = p.getAttribute("data-season-panel") !== s; });
    }
    $$("[data-season]", hoursEl).forEach(function (b) { b.addEventListener("click", function () { showSeason(b.getAttribute("data-season")); }); });
    showSeason(season);
    var today = HOURS[season][sa.day];
    var nowEl = $("[data-open-now]", hoursEl);
    var fmt = function (h) { return pad(Math.floor(h)) + ":00"; };
    if (today && sa.hour >= today[0] && sa.hour < today[1]) {
      nowEl.textContent = "Open now until " + fmt(today[1]);
      nowEl.classList.add("is-open");
    } else if (today && sa.hour < today[0]) {
      nowEl.textContent = "Opens today at " + fmt(today[0]);
    } else {
      nowEl.textContent = "Closed right now";
    }
  }

  /* ---------------- misc ---------------- */
  var y = $("[data-year]");
  if (y) y.textContent = new Date().getFullYear();

  window.addEventListener("load", function () { hasGsap && ScrollTrigger.refresh(); });
})();
