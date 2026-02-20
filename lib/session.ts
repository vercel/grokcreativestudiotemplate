import { cache } from "react";
import { verifySession } from "@/lib/auth";

export const getSession = cache(verifySession);
