// Loaded lazily by <LazyMotion> (see App.tsx) so framer-motion's heavy DOM feature
// bundle — gestures, layout projection, drag — is fetched in its own async chunk
// AFTER first paint, instead of blocking the initial render. The lightweight `m`
// primitive + LazyMotion core stay eager; only the features defer.
//
// domMax (not domAnimation) is required: GlassTabs uses `layoutId` and Toast uses
// `layout`, both of which need layout projection.
import { domMax } from "framer-motion";

export default domMax;
