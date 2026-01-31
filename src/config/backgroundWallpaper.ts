import type { BackgroundWallpaperConfig } from "@/types/config";

export const backgroundWallpaper: BackgroundWallpaperConfig = {
	// 壁纸模式："banner" 横幅壁纸，"overlay" 全屏透明，"none" 纯色背景无壁纸
	mode: "banner",
	// 是否允许用户通过导航栏切换壁纸模式，设为false可提升性能（只渲染当前模式）
	switchable: true,
	// 背景图片配置
	src: {
		// 桌面背景图片
		desktop: "/assets/images/d1.webp",
		// 移动背景图片
		mobile: "/assets/images/m1.png",
	},
	// Banner模式特有配置
	banner: {
		// 图片位置
		// 支持所有CSS object-position值，如: 'top', 'center', 'bottom', 'left top', 'right bottom', '25% 75%', '10px 20px'..
		// 如果不知道怎么配置百分百之类的配置，推荐直接使用：'center'居中，'top'顶部居中，'bottom' 底部居中，'left'左侧居中，'right'右侧居中
		position: "0% 20%",

		// 主页横幅文字
		homeText: {
			// 是否启用主页横幅文字
			enable: true,
			// 主页横幅主标题
			title: "静坐观云，偶作闲谈",
			// 主页横幅主标题字体大小
			titleSize: "3.8rem",
			// 主页横幅副标题
			subtitle: [
				"看似寻常最奇崛，成如容易却艰辛。",
				"操千曲而后晓声，观千剑而后识器。",
				"偶得幽闲境，遂忘尘俗心。",
				"细雨湿衣看不见，闲花落地听无声。",
				"流光容易把人抛，红了樱桃，绿了芭蕉。",
				"草木本无意，荣枯自有时。",
			],
			// 主页横幅副标题字体大小
			subtitleSize: "1.5rem",
			typewriter: {
				// 是否启用打字机效果
				// 打字机开启 → 循环显示所有副标题
				// 打字机关闭 → 每次刷新随机显示一条副标题
				enable: true,
				// 打字速度（毫秒）
				speed: 100,
				// 删除速度（毫秒）
				deleteSpeed: 50,
				// 完全显示后的暂停时间（毫秒）
				pauseTime: 2000,
			},
		},
		// 图片来源
		credit: {
			enable: {
				// 桌面端显示横幅图片来源文本
				desktop: false,
				// 移动端显示横幅图片来源文本
				mobile: false,
			},
			text: {
				// 桌面端要显示的来源文本
				desktop: "Pixiv - 晚晚喵",
				// 移动端要显示的来源文本
				mobile: "Haowallpaper - 拍照的男孩",
			},
			url: {
				// 桌面端原始艺术品或艺术家页面的 URL 链接
				desktop: "https://www.pixiv.net/artworks/135490046",
				// 移动端原始艺术品或艺术家页面的 URL 链接
				mobile: "https://haowallpaper.com/mobileViewLook/15012804018670912",
			},
		},
		// 横幅导航栏配置
		navbar: {
			// 横幅导航栏透明模式："semi" 半透明，"full" 完全透明，"semifull" 动态透明
			transparentMode: "semifull",
			// 是否开启毛玻璃模糊效果，开启可能会影响页面性能，如果不开启则是半透明，请根据自己的喜好开启
			enableBlur: true,
			// 毛玻璃模糊度
			blur: 3,
		},
		// 波浪动画效果配置，开启可能会影响页面性能，请根据自己的喜好开启
		waves: {
			enable: {
				// 桌面端是否启用波浪动画效果
				desktop: true,
				// 移动端是否启用波浪动画效果
				mobile: true,
			},
		},
	},
	// 全屏透明覆盖模式特有配置
	overlay: {
		// 层级，确保壁纸在背景层
		zIndex: -1,
		// 壁纸透明度
		opacity: 0.8,
		// 背景模糊程度
		blur: 1,
	},
};
