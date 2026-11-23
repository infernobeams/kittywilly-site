// falling-stars canvas animation for INSANITY
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.createElement('canvas');
    canvas.id = 'star-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none'; // click-through
    canvas.style.zIndex = '-1';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    let stars = [];
    const maxStars = 120;
    
    // Mouse coordinates for interaction
    let mouse = { x: -1000, y: -1000, active: false };

    // Resize canvas to cover window
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Track mouse movement
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    });

    window.addEventListener('mouseleave', () => {
        mouse.active = false;
    });

    // Star constructor
    class Star {
        constructor() {
            this.reset(true);
        }

        reset(initial = false) {
            this.x = Math.random() * canvas.width;
            // If initial load, distribute across screen height; otherwise, start at top
            this.y = initial ? Math.random() * canvas.height : -10;
            this.size = Math.random() * 1.5 + 0.5; // Small and nice stars (0.5px to 2px)
            this.speed = Math.random() * 1.5 + 0.5; // Speed between 0.5 and 2.0 px/frame
            this.opacity = Math.random() * 0.7 + 0.3; // Random opacity
            this.drift = Math.random() * 0.4 - 0.2; // Slight horizontal drift
            this.color = Math.random() > 0.15 ? '#ffffff' : '#e2e8f0'; // 15% stars are slate-grey (for depth)
            
            // Interaction offsets
            this.offsetX = 0;
            this.offsetY = 0;
        }

        update() {
            // Mouse interaction deflection
            if (mouse.active) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const repelDist = 120; // Radius of interaction

                if (distance < repelDist) {
                    const force = (repelDist - distance) / repelDist; // 0 (far) to 1 (close)
                    // Push away from mouse
                    this.offsetX += (dx / distance) * force * 2;
                    this.offsetY += (dy / distance) * force * 2;
                }
            }

            // Apply friction/decay to offsets to return to normal trajectory
            this.offsetX *= 0.95;
            this.offsetY *= 0.95;

            // Move
            this.y += this.speed + this.offsetY;
            this.x += this.drift + this.offsetX;

            // Reset when falling off screen
            if (this.y > canvas.height || this.x < 0 || this.x > canvas.width) {
                this.reset(false);
            }
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.shadowBlur = this.size * 2;
            ctx.shadowColor = this.color;
            ctx.globalAlpha = this.opacity;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0; // reset
        }
    }

    // Initialize stars
    for (let i = 0; i < maxStars; i++) {
        stars.push(new Star());
    }

    // Main animation loop
    function animate() {
        // Clear canvas with a very transparent dark to leave a subtle star path/trail
        ctx.fillStyle = 'rgba(5, 8, 14, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        stars.forEach(star => {
            star.update();
            star.draw();
        });

        requestAnimationFrame(animate);
    }

    animate();
});
