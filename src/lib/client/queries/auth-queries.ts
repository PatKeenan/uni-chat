import { getUser } from "@/server/actions/auth-actions";

export const getUserQuery = {
	queryKey: ["user"],
	queryFn: getUser,
};
