import { defineConfig, devices } from "@playwright/test";
const port = process.env.CAREERMAP_INTEGRATED_E2E_PORT || "3112";
if (!/^[0-9]+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw new Error("Invalid integration test port");
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
 testDir:"./tests/e2e-integrated",workers:1,timeout:60000,outputDir:"test-results-integrated",
 reporter:[["list"],["html",{open:"never",outputFolder:"playwright-report-integrated"}]],
 use:{baseURL,actionTimeout:10000,trace:"retain-on-failure",screenshot:"only-on-failure",serviceWorkers:"block"},
 projects:[{name:"desktop",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:1000}}},{name:"tablet",use:{...devices["Desktop Chrome"],viewport:{width:834,height:1100}}}],
 webServer:{command:`node scripts/dev-mapping.mjs --end-to-end --host 127.0.0.1 --port ${port}`,url:`${baseURL}/`,reuseExistingServer:false,timeout:90000,env:{CAREERMAP_SURVEY_ADMIN_TOKEN:"synthetic-integration-password-at-least-32-characters",CAREERMAP_DONATION_E2E:"1",CAREERMAP_INTEGRATED_E2E_PORT:port},gracefulShutdown:{signal:"SIGTERM",timeout:10000}}
});
