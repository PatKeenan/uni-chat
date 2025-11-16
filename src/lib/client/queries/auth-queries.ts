import { getUser } from "@/lib/server/actions/auth-actions";

export const getUserQuery = {
	queryKey: ["user"],
	queryFn: getUser,
};
