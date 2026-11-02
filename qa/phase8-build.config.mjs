// QA-only build identity. Application sources and runtime policy are unchanged.
import { mergeConfig } from "vite";
import base from "../vite.config.ts";
export default mergeConfig(base, {
  plugins: [
    {
      name: "phase8-build-marker",
      transformIndexHtml(html) {
        return html.replace(
          "</head>",
          `<meta name="sagi-qa-build" content="${process.env.SAGI_QA_BUILD_ID}"></head>`,
        );
      },
    },
  ],
});
