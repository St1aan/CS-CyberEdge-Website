(function () {
    'use strict';

    function rand(lo, hi) { return lo + Math.random() * (hi - lo); }

    var canvas, ctx, dpr;
    var CELL = 55;
    var segments = [], nodes = [], pulses = [], litSegs = [];

    // ── Bootstrap ──────────────────────────────────────────────────────────
    function init() {
        // Single fixed canvas covering the entire viewport, behind all content
        canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:-1;';
        document.body.insertBefore(canvas, document.body.firstChild);
        ctx = canvas.getContext('2d');

        // Strip the old CSS dot-grid pattern from every .grid-bg element
        document.querySelectorAll('.grid-bg').forEach(function (el) {
            el.style.backgroundImage = 'none';
        });

        resize();
        window.addEventListener('resize', resize);
        requestAnimationFrame(tick);
    }

    // ── Canvas sizing (DPR-aware) ──────────────────────────────────────────
    function resize() {
        dpr = window.devicePixelRatio || 1;
        canvas.width  = window.innerWidth  * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        build();
    }

    // ── Graph construction ─────────────────────────────────────────────────
    function build() {
        var W    = window.innerWidth;
        var H    = window.innerHeight;
        var cols = Math.ceil(W / CELL) + 2;
        var rows = Math.ceil(H / CELL) + 2;

        segments = [];
        nodes    = [];
        pulses   = [];
        litSegs  = [];

        var map = new Map();
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var n = { x: c * CELL, y: r * CELL, nb: [] };
                map.set(r * 10000 + c, n);
                nodes.push(n);
            }
        }
        for (var r2 = 0; r2 < rows; r2++) {
            for (var c2 = 0; c2 < cols; c2++) {
                var node = map.get(r2 * 10000 + c2);
                if (c2 < cols - 1 && Math.random() < 0.58) {
                    var right = map.get(r2 * 10000 + c2 + 1);
                    node.nb.push(right); right.nb.push(node);
                    segments.push([node, right]);
                }
                if (r2 < rows - 1 && Math.random() < 0.52) {
                    var down = map.get((r2 + 1) * 10000 + c2);
                    node.nb.push(down); down.nb.push(node);
                    segments.push([node, down]);
                }
            }
        }
    }

    // ── Spawn a new pulse at a random node ────────────────────────────────
    function spawn() {
        var pool = nodes.filter(function (n) { return n.nb.length > 0; });
        if (!pool.length) return;
        var from = pool[(Math.random() * pool.length) | 0];
        var to   = from.nb[(Math.random() * from.nb.length) | 0];
        pulses.push({ from: from, to: to, t: 0, speed: rand(0.007, 0.022) });
    }

    // ── Render loop ────────────────────────────────────────────────────────
    function tick() {
        var W = window.innerWidth;
        var H = window.innerHeight;

        ctx.clearRect(0, 0, W, H);

        // Base traces
        ctx.strokeStyle = 'rgba(0,210,255,0.07)';
        ctx.lineWidth   = 1;
        for (var i = 0; i < segments.length; i++) {
            ctx.beginPath();
            ctx.moveTo(segments[i][0].x, segments[i][0].y);
            ctx.lineTo(segments[i][1].x, segments[i][1].y);
            ctx.stroke();
        }

        // Junction vias
        for (var j = 0; j < nodes.length; j++) {
            var nd = nodes[j];
            if (nd.nb.length >= 2) {
                ctx.fillStyle = nd.nb.length >= 3 ? 'rgba(0,210,255,0.18)' : 'rgba(0,210,255,0.11)';
                ctx.beginPath();
                ctx.arc(nd.x, nd.y, nd.nb.length >= 3 ? 2 : 1.5, 0, 6.283);
                ctx.fill();
            }
        }

        // Fading trail segments
        var liveSegs = [];
        for (var ls = 0; ls < litSegs.length; ls++) {
            var lit = litSegs[ls];
            lit.alpha -= 0.016;
            if (lit.alpha > 0) {
                ctx.strokeStyle = 'rgba(0,210,255,' + lit.alpha.toFixed(3) + ')';
                ctx.lineWidth   = 1.5;
                ctx.beginPath();
                ctx.moveTo(lit.ax, lit.ay);
                ctx.lineTo(lit.bx, lit.by);
                ctx.stroke();
                liveSegs.push(lit);
            }
        }
        litSegs = liveSegs;

        // Active pulse heads
        var keep = [];
        for (var p = 0; p < pulses.length; p++) {
            var pulse = pulses[p];
            pulse.t += pulse.speed;

            // Lit segment beneath the travelling pulse
            ctx.strokeStyle = 'rgba(0,210,255,0.55)';
            ctx.lineWidth   = 1.5;
            ctx.beginPath();
            ctx.moveTo(pulse.from.x, pulse.from.y);
            ctx.lineTo(pulse.to.x,   pulse.to.y);
            ctx.stroke();

            // Pulse head position
            var t  = Math.min(pulse.t, 1);
            var px = pulse.from.x + (pulse.to.x - pulse.from.x) * t;
            var py = pulse.from.y + (pulse.to.y - pulse.from.y) * t;

            // Outer glow
            var g = ctx.createRadialGradient(px, py, 0, px, py, 18);
            g.addColorStop(0,    'rgba(0,210,255,0.9)');
            g.addColorStop(0.3,  'rgba(0,210,255,0.35)');
            g.addColorStop(1,    'rgba(0,210,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(px, py, 18, 0, 6.283);
            ctx.fill();

            // Bright core dot
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, 6.283);
            ctx.fill();

            if (pulse.t >= 1) {
                // Deposit fading trail
                litSegs.push({ ax: pulse.from.x, ay: pulse.from.y,
                                bx: pulse.to.x,   by: pulse.to.y, alpha: 0.45 });
                var nexts = pulse.to.nb.filter(function (n) { return n !== pulse.from; });
                if (nexts.length && Math.random() > 0.08) {
                    pulse.from = pulse.to;
                    pulse.to   = nexts[(Math.random() * nexts.length) | 0];
                    pulse.t   -= 1;
                    keep.push(pulse);
                }
                // else pulse dies naturally — makes gaps feel random
            } else {
                keep.push(pulse);
            }
        }
        pulses = keep;

        // Spawn new pulses at random intervals
        if (Math.random() < 0.05 && pulses.length < 22) spawn();

        requestAnimationFrame(tick);
    }

    document.addEventListener('DOMContentLoaded', init);
}());
