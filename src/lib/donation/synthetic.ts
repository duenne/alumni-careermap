import { readCareerSnapshot, suggestReviews } from "../career-import/mapping";
/** New authored case, independent of all local corpora and personal data. */
export function syntheticDonation(programId:string){
 const snapshot=readCareerSnapshot({elements:[{snapshotDomain:"EDUCATION",snapshotData:[
  {"Degree Name":"Synthetic Bachelor MSI","School Name":"Synthetic Institute","Start Date":"2015","End Date":"2019"},
  {"Degree Name":"Synthetic Master Sustainability","School Name":"Synthetic Graduate School","Start Date":"2020","End Date":"2022"}
 ]},{snapshotDomain:"POSITIONS",snapshotData:[{Title:"Synthetic Analyst","Company Name":"Synthetic Organisation","Started On":"2020","Finished On":"2023"}]}]});
 const reviews=suggestReviews(snapshot).map(r=>({...r,position:r.sourceKey==="snapshot:2:0"?1:r.sourceKey==="snapshot:2:1"?2:3,catalog:r.sourceKey==="snapshot:2:0"?`PROGRAM:${programId}`:r.catalog,details:{field:r.classification==="DEGREE:MASTER"?"Nachhaltigkeit":"",job:r.classification.startsWith("CAREER_STEP")?"Analyse":"",sector:r.classification.startsWith("CAREER_STEP")?"Beratung":""}}));
 return {snapshot,reviews,candidateSourceKey:null};
}
