import { expect, it } from "vitest";
import { mapCareerImport, readCareerSnapshot, suggestReviews } from "./mapping";
it("accepts explicit field/job/sector review without source inference and rejects extra fields",()=>{
 const snapshot=readCareerSnapshot({elements:[{snapshotDomain:"EDUCATION",snapshotData:[{"Degree Name":"Bachelor","Start Date":"2017","End Date":"2020"}]},{snapshotDomain:"POSITIONS",snapshotData:[{Title:"Synthetic job","Started On":"2021","Finished On":"2022"}]}]});
 const reviews=suggestReviews(snapshot).map(r=>({...r,details:{field:" Synthetic field ",job:"Synthetic job category",sector:"Synthetic sector"}}));
 const mapped=mapCareerImport(snapshot,reviews);
 expect(mapped.stations.find(s=>s.kind==="RESOLVED_DEGREE")?.canonical).toMatchObject({fieldOfStudy:"Synthetic field"});
 expect(mapped.stations.find(s=>s.kind==="RESOLVED_CAREER_STEP")?.canonical).toMatchObject({roleCategory:"Synthetic job category"});
 expect(()=>mapCareerImport(snapshot,reviews.map(r=>({...r,details:{...r.details,email:"private"}})))).toThrow();
});
