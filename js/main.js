(function(){
  'use strict';

  /* ── Nav toggle ───────────────────────────────── */
  var toggle = document.querySelector('.nav-toggle');
  var links  = document.querySelector('.nav-links');
  if(toggle && links){
    toggle.addEventListener('click', function(){
      links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', links.classList.contains('open'));
    });
    links.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', function(){ links.classList.remove('open'); });
    });
  }

  /* ── Active nav link ──────────────────────────── */
  /* Vercel cleanUrls serves /about instead of /about.html, so compare without the extension */
  function pageName(path){
    var name = (path || '').split('/').pop().replace(/\.html$/, '');
    return name === '' ? 'index' : name;
  }
  var here = pageName(location.pathname);
  document.querySelectorAll('.nav-links a, .mobile-bottom-nav a').forEach(function(a){
    if(pageName(a.getAttribute('href')) === here){
      a.classList.add('active');
    }
  });

  /* ── Year stamp ───────────────────────────────── */
  var y = document.getElementById('year');
  if(y) y.textContent = new Date().getFullYear();

  /* ── Scroll reveal ────────────────────────────── */
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){ e.target.classList.add('visible'); io.unobserve(e.target); }
      });
    }, {threshold: 0.08});
    document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
  } else {
    document.querySelectorAll('.reveal').forEach(function(el){ el.classList.add('visible'); });
  }

  /* ── Flame canvas ─────────────────────────────── */
  var canvas = document.getElementById('flame-canvas');
  if(canvas){
    var ctx = canvas.getContext('2d');
    var W, H, particles = [];
    var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function resize(){
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function Particle(x){
      this.reset(x);
    }
    Particle.prototype.reset = function(x){
      this.x = x !== undefined ? x : Math.random() * W;
      this.y = H;
      this.vy = -(1.2 + Math.random() * 2.8);
      this.vx = (Math.random() - 0.5) * 0.6;
      this.life = 0;
      this.maxLife = 55 + Math.random() * 60;
      this.size = 8 + Math.random() * 22;
      this.hue = 18 + Math.random() * 24;   /* orange-red */
      this.sat  = 90 + Math.random() * 10;
    };
    Particle.prototype.update = function(){
      this.life++;
      this.y  += this.vy;
      this.x  += this.vx + Math.sin(this.life * 0.12) * 0.5;
      this.vy *= 0.990;
      this.size *= 0.982;
    };
    Particle.prototype.draw = function(){
      var t   = this.life / this.maxLife;
      var alpha = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
      alpha = Math.max(0, Math.min(1, alpha)) * 0.75;
      /* shift hue toward gold at tip */
      var hue = this.hue + t * 30;
      var lum = 48 + t * 18;
      var grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
      grad.addColorStop(0, 'hsla(' + hue + ',' + this.sat + '%,' + lum + '%,' + alpha + ')');
      grad.addColorStop(1, 'hsla(' + hue + ',' + this.sat + '%,' + (lum + 20) + '%,0)');
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    };

    /* seed columns */
    var columns = 7;
    for(var i = 0; i < columns; i++){
      for(var j = 0; j < 6; j++){
        var p = new Particle((i + 0.5) / columns * W + (Math.random() - 0.5) * 60);
        p.life = Math.floor(Math.random() * p.maxLife);
        particles.push(p);
      }
    }

    function animate(){
      if(prefersReduced) return;
      requestAnimationFrame(animate);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      /* spawn new */
      if(Math.random() < 0.55){
        var col = Math.floor(Math.random() * columns);
        particles.push(new Particle((col + 0.5) / columns * W + (Math.random() - 0.5) * 80));
      }

      particles = particles.filter(function(p){
        p.update();
        p.draw();
        return p.life < p.maxLife;
      });

      ctx.globalCompositeOperation = 'source-over';
    }
    animate();
  }

  /* ── Animated counters ────────────────────────── */
  function animateCounter(el){
    var target = parseFloat(el.dataset.target) || 0;
    var isPercent = el.dataset.suffix === '%';
    var duration = 1400;
    var start = null;
    function step(ts){
      if(!start) start = ts;
      var progress = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var val = Math.round(eased * target);
      el.textContent = val + (isPercent ? '%' : '');
      if(progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  if('IntersectionObserver' in window){
    var cio = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting){
          animateCounter(e.target);
          cio.unobserve(e.target);
        }
      });
    }, {threshold: 0.5});
    document.querySelectorAll('[data-target]').forEach(function(el){ cio.observe(el); });
  }

  /* ── Gallery lightbox (simple) ───────────────── */
  document.querySelectorAll('.gallery-item').forEach(function(item){
    item.addEventListener('click', function(){
      var img = item.querySelector('img');
      var cap = item.querySelector('.gallery-caption');
      if(!img) return;
      var overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(7,21,46,.95);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;cursor:zoom-out;padding:24px;backdrop-filter:blur(8px);';
      var i2 = document.createElement('img');
      i2.src = img.src;
      i2.style.cssText = 'max-width:90vw;max-height:80vh;object-fit:contain;border-radius:4px;box-shadow:0 16px 64px rgba(0,0,0,.6);';
      overlay.appendChild(i2);
      if(cap){
        var lbl = document.createElement('p');
        lbl.textContent = cap.textContent;
        lbl.style.cssText = 'color:rgba(255,255,255,.7);font-family:monospace;font-size:.78rem;letter-spacing:.1em;text-transform:uppercase;margin:0;';
        overlay.appendChild(lbl);
      }
      overlay.addEventListener('click', function(){ document.body.removeChild(overlay); });
      document.body.appendChild(overlay);
    });
  });

})();
