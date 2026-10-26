import type { BackgroundWallpaperConfig } from "@/types/backgroundWallpaper";

export const wallpaperThemes = {
	mujicaMygo: "/assets/images/banner/mujica-mygo.png",
	eveningLamps: "/assets/images/banner/themes/evening-lamps-mountains.webp",
	winterSweater: "/assets/images/banner/themes/winter-sweater-selfie.webp",
	mujicaMygoRoom: "/assets/images/banner/themes/mujica-mygo-room.webp",
};

export const videoWallpaperThemes: string[] = [
	"/assets/videos/wallpapers/kuroha-line-art-1080p.mp4",
	"/assets/videos/wallpapers/silhouette-multiexposure-1080p.mp4",
];

// 换静态主题只需要修改这一行；改为字符串数组时可配合 carousel.enable 开启轮播。
const activeWallpaper: string | string[] = [
	wallpaperThemes.mujicaMygo,
	wallpaperThemes.eveningLamps,
	wallpaperThemes.winterSweater,
	wallpaperThemes.mujicaMygoRoom,
];

export const backgroundWallpaper: BackgroundWallpaperConfig = {
	mode: "banner",
	playerEnable: true,
	src: {
		desktop: activeWallpaper,
		mobile: activeWallpaper,
		playerUrl: videoWallpaperThemes,
	},
	common: {
		dimOpacity: 0.5,
		playerMode: "order",
		homeText: {
			enable: true,
			title: "luanluan1",
			titleSize: "4rem",
			subtitle:
				"持续实践 AI 应用开发，记录从模型微调调用到业务落地的工程问题。",
			subtitleSize: "1.25rem",
			typewriter: {
				enable: true,
				speed: 80,
				deleteSpeed: 40,
				pauseTime: 2000,
			},
		},
		postInfo: { mode: "description" },
		navbar: {
			transparentMode: "semi",
			blur: 10,
		},
		waves: {
			enable: { desktop: true, mobile: true },
		},
		gradient: {
			enable: { desktop: true, mobile: true },
			height: "28%",
		},
		carousel: {
			enable: true,
			interval: 5000,
			transitionEffect: "fade",
		},
	},
	banner: { position: "62% 12%" },
	overlay: {
		zIndex: -1,
		opacity: 0.8,
		blur: 10,
		cardOpacity: 0.75,
	},
	fullscreen: { position: "center" },
};
