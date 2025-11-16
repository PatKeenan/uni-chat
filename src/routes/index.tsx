import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: App });

function App() {
	return (
		<div className="h-screen flex overflow-hidden bg-gray-100">
			{/* Sidebar */}
			<aside className="gap-6 flex flex-col w-80 border-r border-gray-300 py-8 ">
				{/* header in sidebard */}
				<div className="px-8 pb-6 border-b border-gray-300">
					<img
						src="/tanstack-circle-logo.png"
						alt="Logo"
						className="h-12 object-contain"
					/>
				</div>

				{/* content in sidebard */}

				<nav className="px-8 pb-8 flex flex-col gap-4 border-b border-gray-300 grow">
					<Link to="/">Home</Link>
					{Array.from({ length: 4 }).map((_, u) => {
						return (
							<a href={`/demo/start/ssr/spa-mode`} key={u}>
								<span className="font-medium">Item {u + 1}</span>
							</a>
						);
					})}
				</nav>

				{/* footer in sidebard */}
				<div className="px-8 pb-3">
					<div>footer</div>
				</div>
			</aside>
			<main>
				{/* Header */}
				<section></section>

				{/* Content */}
				<section></section>
			</main>
		</div>
	);
}
