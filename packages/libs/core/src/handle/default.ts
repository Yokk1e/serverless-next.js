import { renderErrorPage } from "./error";
import { setCustomHeaders } from "./headers";
import { redirect } from "./redirect";
import { toRequest } from "./request";
import { routeDefault } from "../route";
import {
  Event,
  ExternalRoute,
  PageManifest,
  PrerenderManifest,
  PublicFileRoute,
  RedirectRoute,
  RenderRoute,
  RoutesManifest,
  StaticRoute,
  UnauthorizedRoute
} from "../types";
import { unauthorized } from "./unauthorized";

export const renderRoute = async (
  event: Event,
  route: RenderRoute,
  routesManifest: RoutesManifest,
  getPage: (page: string) => any
) => {
  const { req, res } = event;
  setCustomHeaders(event, routesManifest);

  // If page is _error.js, set status to 404 so _error.js will render a 404 page
  if (route.page === "pages/_error.js") {
    res.statusCode = 404;
  }

  const page = getPage(route.page);
  try {
    if (route.isData) {
      const { renderOpts } = await page.renderReqToHTML(
        req,
        res,
        "passthrough"
      );
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(renderOpts.pageData));
    } else {
      await Promise.race([page.render(req, res), event.responsePromise]);
    }
  } catch (error) {
    renderErrorPage(error, event, route.page, getPage);
  }
};

/*
 * Handles page and data routes.
 *
 * Returns one of: ExternalRoute, PublicFileRoute, StaticRoute
 * for handling in the caller.
 *
 * If return is void, the response has already been generated in
 * event.res/event.responsePromise which the caller should wait on.
 */
export const handleDefault = async (
  event: Event,
  manifest: PageManifest,
  prerenderManifest: PrerenderManifest,
  routesManifest: RoutesManifest,
  getPage: (page: string) => any
): Promise<ExternalRoute | PublicFileRoute | StaticRoute | void> => {
  const request = toRequest(event);
  const route = await routeDefault(
    request,
    manifest,
    prerenderManifest,
    routesManifest
  );
  if (route.querystring) {
    event.req.url = `${event.req.url}${request.querystring ? "&" : "?"}${
      route.querystring
    }`;
  }
  if (route.isRedirect) {
    return redirect(event, route as RedirectRoute);
  }
  if (route.isRender) {
    return renderRoute(event, route as RenderRoute, routesManifest, getPage);
  }
  if (route.isUnauthorized) {
    return unauthorized(event, route as UnauthorizedRoute);
  }

  // Let typescript check this is correct type to be returned
  return route;
};
