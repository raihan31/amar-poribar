import { setupServer } from "msw/node";
import { bindServer, handlers } from "./handlers";

export const server = setupServer(...handlers);
bindServer(server);
