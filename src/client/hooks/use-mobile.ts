import { useEffect, useState } from "react";

export const useIsMobile = (breakpoint = 768) => {
	// Default breakpoint for mobile
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < breakpoint);
		};

		checkMobile(); // Initial check
		window.addEventListener("resize", checkMobile);

		return () => window.removeEventListener("resize", checkMobile);
	}, [breakpoint]);

	return isMobile;
};
