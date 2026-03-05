/**
 * Script to generate all required app icons and splash screen images
 * from the source logo.png (1024×1024).
 *
 * Usage: bun run scripts/generate-icons.ts
 */
import sharp from 'sharp'
import { join } from 'path'
import { mkdirSync } from 'fs'

const ROOT = join(import.meta.dir, '..')
const LOGO = join(ROOT, 'public', 'logo.png')
const ANDROID_RES = join(ROOT, 'App_Resources', 'Android', 'src', 'main', 'res')
const IOS_ASSETS = join(ROOT, 'App_Resources', 'iOS', 'Assets.xcassets')

// ─── Android Mipmap (legacy launcher icons) ──────────────────────
const MIPMAP_SIZES: Record<string, number> = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192,
}

// ─── Android Adaptive Icon Foreground ─────────────────────────────
// The foreground canvas is 108dp. The icon safe zone is the inner 72dp (66%).
// Since the logo has baked-in rounded corners, we shrink to ~52% so the
// inscribed circle of any mask shape never clips the icon content.
const FOREGROUND_SIZES: Record<string, number> = {
    'drawable-mdpi': 108,
    'drawable-hdpi': 162,
    'drawable-xhdpi': 216,
    'drawable-xxhdpi': 324,
    'drawable-xxxhdpi': 432,
}

// ─── iOS App Icons ───────────────────────────────────────────────
const IOS_ICONS: { name: string; size: number }[] = [
    { name: 'icon-20.png', size: 20 },
    { name: 'icon-20@2x.png', size: 40 },
    { name: 'icon-20@3x.png', size: 60 },
    { name: 'icon-29.png', size: 29 },
    { name: 'icon-29@2x.png', size: 58 },
    { name: 'icon-29@3x.png', size: 87 },
    { name: 'icon-40.png', size: 40 },
    { name: 'icon-40@2x.png', size: 80 },
    { name: 'icon-40@3x.png', size: 120 },
    { name: 'icon-60@2x.png', size: 120 },
    { name: 'icon-60@3x.png', size: 180 },
    { name: 'icon-76.png', size: 76 },
    { name: 'icon-76@2x.png', size: 152 },
    { name: 'icon-83.5@2x.png', size: 167 },
    { name: 'icon-1024.png', size: 1024 },
]

// ─── iOS Launch Screen Images ────────────────────────────────────
const IOS_LAUNCH_ASPECT_FILL: { name: string; w: number; h: number }[] = [
    { name: 'LaunchScreen-AspectFill.png', w: 768, h: 1024 },
    { name: 'LaunchScreen-AspectFill@2x.png', w: 1536, h: 2048 },
    { name: 'LaunchScreen-AspectFill@3x.png', w: 2304, h: 3072 },
]

const IOS_LAUNCH_CENTER: { name: string; size: number }[] = [
    { name: 'LaunchScreen-Center.png', size: 384 },
    { name: 'LaunchScreen-Center@2x.png', size: 768 },
    { name: 'LaunchScreen-Center@3x.png', size: 1152 },
]

async function generateAndroidMipmaps() {
    console.log('📱 Generating Android mipmap icons...')
    for (const [folder, size] of Object.entries(MIPMAP_SIZES)) {
        const dir = join(ANDROID_RES, folder)
        mkdirSync(dir, { recursive: true })
        await sharp(LOGO)
            .resize(size, size, { fit: 'contain' })
            .png()
            .toFile(join(dir, 'ic_launcher.png'))
        console.log(`  ✓ ${folder}/ic_launcher.png (${size}×${size})`)
    }
}

async function generateAdaptiveForegrounds() {
    console.log('🎨 Generating Android adaptive icon foregrounds...')
    for (const [folder, canvasSize] of Object.entries(FOREGROUND_SIZES)) {
        const dir = join(ANDROID_RES, folder)
        mkdirSync(dir, { recursive: true })

        // Icon occupies ~52% of the canvas — smaller than the standard 66%
        // safe zone because the logo has baked-in rounded corners that would
        // be clipped by circular masks at 66%.
        const iconSize = Math.round(canvasSize * 0.52)

        // Create the logo resized to the safe zone
        const resizedLogo = await sharp(LOGO)
            .resize(iconSize, iconSize, { fit: 'contain' })
            .png()
            .toBuffer()

        // Composite onto a transparent canvas
        await sharp({
            create: {
                width: canvasSize,
                height: canvasSize,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 0 },
            },
        })
            .composite([{ input: resizedLogo, gravity: 'centre' }])
            .png()
            .toFile(join(dir, 'ic_launcher_foreground.png'))

        console.log(`  ✓ ${folder}/ic_launcher_foreground.png (${canvasSize}×${canvasSize}, icon ${iconSize}×${iconSize})`)
    }
}

async function generateAndroidSplashLogo() {
    console.log('💦 Generating Android splash screen logo...')
    const dir = join(ANDROID_RES, 'drawable-nodpi')
    mkdirSync(dir, { recursive: true })

    // Android 12+ splash screen applies a circular mask to the icon.
    // The visible area is a circle inscribed in the icon canvas.
    // We place the logo at ~55% of a 960×960 canvas so the content
    // (cross + hands) fits fully within the circular mask.
    const canvasSize = 960
    const logoSize = Math.round(canvasSize * 0.55)

    const resizedLogo = await sharp(LOGO)
        .resize(logoSize, logoSize, { fit: 'contain' })
        .png()
        .toBuffer()

    await sharp({
        create: {
            width: canvasSize,
            height: canvasSize,
            channels: 4,
            background: { r: 245, g: 197, b: 66, alpha: 255 }, // #F5C542 — matches splash background
        },
    })
        .composite([{ input: resizedLogo, gravity: 'centre' }])
        .png()
        .toFile(join(dir, 'ic_app_logo.png'))

    console.log(`  ✓ drawable-nodpi/ic_app_logo.png (${canvasSize}×${canvasSize}, logo ${logoSize}×${logoSize})`)
}

async function generateIosIcons() {
    console.log('🍎 Generating iOS app icons...')
    const dir = join(IOS_ASSETS, 'AppIcon.appiconset')
    mkdirSync(dir, { recursive: true })

    for (const icon of IOS_ICONS) {
        await sharp(LOGO)
            .resize(icon.size, icon.size, { fit: 'contain' })
            .png()
            .toFile(join(dir, icon.name))
        console.log(`  ✓ ${icon.name} (${icon.size}×${icon.size})`)
    }
}

async function generateIosLaunchScreens() {
    console.log('🚀 Generating iOS launch screen images...')

    // AspectFill — golden yellow background with centered logo
    const aspectFillDir = join(IOS_ASSETS, 'LaunchScreen.AspectFill.imageset')
    mkdirSync(aspectFillDir, { recursive: true })

    for (const img of IOS_LAUNCH_ASPECT_FILL) {
        const logoSize = Math.round(Math.min(img.w, img.h) * 0.4)
        const resizedLogo = await sharp(LOGO)
            .resize(logoSize, logoSize, { fit: 'contain' })
            .png()
            .toBuffer()

        await sharp({
            create: {
                width: img.w,
                height: img.h,
                channels: 4,
                background: { r: 245, g: 197, b: 66, alpha: 255 }, // #F5C542
            },
        })
            .composite([{ input: resizedLogo, gravity: 'centre' }])
            .png()
            .toFile(join(aspectFillDir, img.name))

        console.log(`  ✓ ${img.name} (${img.w}×${img.h})`)
    }

    // Center — just the logo on transparent background
    const centerDir = join(IOS_ASSETS, 'LaunchScreen.Center.imageset')
    mkdirSync(centerDir, { recursive: true })

    for (const img of IOS_LAUNCH_CENTER) {
        await sharp(LOGO)
            .resize(img.size, img.size, { fit: 'contain' })
            .png()
            .toFile(join(centerDir, img.name))

        console.log(`  ✓ ${img.name} (${img.size}×${img.size})`)
    }
}

async function main() {
    console.log('🔧 Generating all app icons and splash images from logo.png...\n')

    await generateAndroidMipmaps()
    console.log()
    await generateAdaptiveForegrounds()
    console.log()
    await generateAndroidSplashLogo()
    console.log()
    await generateIosIcons()
    console.log()
    await generateIosLaunchScreens()

    console.log('\n✅ All icons and splash images generated successfully!')
}

main().catch((err) => {
    console.error('❌ Error generating icons:', err)
    process.exit(1)
})
