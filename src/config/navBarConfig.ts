import {
	type NavBarConfig,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/navBarConfig";

export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

export const navBarConfig: NavBarConfig = {
	links: [
		{
			name: "主页",
			url: "/",
			icon: "material-symbols:home",
		},
		{
			name: "项目",
			url: "/projects/",
			icon: "material-symbols:work-outline-rounded",
		},
		{
			name: "文章",
			url: "/archive/",
			icon: "material-symbols:article-outline",
		},
		{
			name: "关于",
			url: "/about/",
			icon: "material-symbols:person-outline-rounded",
		},
		{
			name: "GitHub",
			url: "https://github.com/luanluan1",
			external: true,
			icon: "fa7-brands:github",
		},
	],
};
