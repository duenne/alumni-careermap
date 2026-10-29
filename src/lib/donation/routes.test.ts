import { beforeEach,afterEach,expect,it,vi } from "vitest";
vi.mock("server-only",()=>({}));
vi.mock("../surveys/service",async original=>({...await original<typeof import("../surveys/service")>(),readSurveyInvitation:vi.fn()}));
vi.mock("../career-import/service",()=>({saveCareerImport:vi.fn()}));
import { NextRequest } from "next/server";
import { createDonationHandlers } from "./routes";
import { readSurveyInvitation } from "../surveys/service";
import { saveCareerImport } from "../career-import/service";
import type { PrismaClient } from "../../generated/prisma/client";
const a="00000000-0000-4000-8000-000000000001",b="00000000-0000-4000-8000-000000000002";
const req=(body?:unknown,cookie="",origin="http://localhost:3111")=>new NextRequest(`http://localhost:3111/api/surveys/${a}/donation`,{method:body?"POST":"GET",headers:{host:"localhost:3111",origin,"content-type":"application/json",cookie},...(body?{body:JSON.stringify(body)}:{})});
beforeEach(()=>{for(const [k,v] of Object.entries({NODE_ENV:"development",CAREERMAP_DEV_SURVEYS:"1",CAREERMAP_DEV_DONATION:"1",CAREERMAP_SYNTHETIC_DONATION:"1",CAREERMAP_SURVEY_OPERATOR_KIND:"INSTITUTION",CAREERMAP_MAPPING_OPERATOR_ID:a}))vi.stubEnv(k,v);
 vi.mocked(readSurveyInvitation).mockResolvedValue({id:a,name:"Synthetic",status:"OPEN",referenceProgram:{id:b,name:"Synthetic MSI",faculty:null,institution:{id:a,name:"Synthetic institute"}}});
 vi.mocked(saveCareerImport).mockResolvedValue({alumniId:"PRIVATE_ID",responseId:"PRIVATE_RESPONSE",degrees:1,careerSteps:0,timelineItems:1});});
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it("binds the participant to one survey and never exposes receipt identifiers or other profiles",async()=>{
 const app=createDonationHandlers(async()=>({} as PrismaClient));
 expect((await app(req(),a)).status).toBe(401);
 const begin=await app(req({begin:"synthetic"}),a);const cookie=begin.cookies.getAll().map(c=>`${c.name}=${c.value}`).join("; ");
 expect((await app(req(undefined,cookie),b)).status).toBe(401);
 const input={surveyId:a};const r=await app(req({submissionId:a,input},cookie),a);
 expect(await r.json()).toEqual({receipt:{degrees:1,careerSteps:0,timelineItems:1},saved:true});
 await app(req({submissionId:a,input},cookie),a);expect(saveCareerImport).toHaveBeenCalledOnce();
 const reload=await app(req(undefined,cookie),a);expect(JSON.stringify(await reload.json())).not.toContain("PRIVATE");
 expect((await app(req({submissionId:a,input:{surveyId:b}},cookie),a)).status).toBe(400);
});
it("rejects production, foreign origins, unbound, draft and closed contexts",async()=>{
 const db=vi.fn(async()=>({} as PrismaClient)),app=createDonationHandlers(db);
 expect((await app(req({begin:"synthetic"},"","https://foreign.invalid"),a)).status).toBe(404);expect(db).not.toHaveBeenCalled();
 for(const status of ["DRAFT","CLOSED"] as const){vi.mocked(readSurveyInvitation).mockResolvedValue({status} as Awaited<ReturnType<typeof readSurveyInvitation>>);expect((await app(req({begin:"synthetic"}),a)).status).toBe(409);}
 vi.stubEnv("NODE_ENV","production");expect((await app(req(),a)).status).toBe(404);expect(saveCareerImport).not.toHaveBeenCalled();
});
