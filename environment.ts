import * as THREE from 'three';

/**
 * Generates a procedural space environment map using a CanvasTexture.
 * This texture is suitable for `scene.environment` to provide reflections
 * for metallic objects like Liquid Metal Blobs.
 */
export function generateEnvironment(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    if (ctx) {
        // 1. Deep Space Background (Gradient top/bottom)
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, '#000000');   // Top (Zenith)
        grad.addColorStop(0.2, '#050011'); // Upper Sky
        grad.addColorStop(0.5, '#1a0033'); // Horizon/Equator (Purple Nebula)
        grad.addColorStop(0.8, '#050011'); // Lower Sky
        grad.addColorStop(1, '#000000');   // Bottom (Nadir)
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 512);

        // 2. Distant Stars
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 512;
            // More stars near center (milky way band)
            const distFromCenter = Math.abs(y - 256) / 256;
            if (Math.random() > distFromCenter) {
                const size = Math.random() * 1.2;
                const opacity = Math.random();
                ctx.globalAlpha = opacity;
                ctx.beginPath();
                ctx.arc(x, y, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1.0;

        // 3. Nebula Clouds (Glows)
        ctx.globalCompositeOperation = 'screen';

        const drawNebula = (x: number, y: number, r: number, color: string) => {
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, color);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        };

        // Blue/Cyan clusters
        drawNebula(200, 256, 150, '#0044ff');
        drawNebula(300, 200, 100, '#00aaff');

        // Pink/Purple clusters
        drawNebula(700, 256, 160, '#ff00aa');
        drawNebula(800, 300, 120, '#aa00ff');

        // Reset composite
        ctx.globalCompositeOperation = 'source-over';
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;

    return texture;
}
