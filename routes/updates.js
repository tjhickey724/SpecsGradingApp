/*
*********************************************************************
Administrative Upgrades
These upgrades are needed to update the database schema
when we make changes to the app 
that require changes to the database schema.
*********************************************************************
*/


var express = require("express");
var app = express.Router();

const Problem = require("../models/Problem");
const Course = require("../models/Course");
const Skill = require("../models/Skill");
const CourseSkill = require("../models/CourseSkill");
const Review = require("../models/Review");
const Answer = require("../models/Answer");
const User = require("../models/User");
const Update = require("../models/Update");

const {authorize, isAdmin} = require("./authFunctions");



const getCurrentVersion = async () => {
    // get the current version, or create it if it doesn't exist
    updates = await Update.find({}).sort({createdAt: -1});
    if (updates.length == 0) {
        const update = new Update({version: "1.0.0", createdAt: new Date()});
        await update.save();
        return "1.0.0";
    } else {
      return updates[0].version;
    }
    };

const updateToVersion = 
  (version) => async (req, res, next) => {
    // check to see if we have already made this update
    let updates = await Update.find({version: version});
    if (updates.length > 0) {
      res.send(`already updated to version ${version}`);
    } else {
        // add the new version to the database
        const update = new Update({version: version, createdAt: new Date()});
        await update.save();
        next();
    }
  };



  const updateProblemMimeType =
    async (req, res, next) => {
      try {
        const problems = await Problem.find({});
        for (let p of problems) {
          if (!p.mimeType || p.mimeType == "text/plain") {
            p.mimeType = "plain";
          }
          await p.save();
        }
        next();
      } catch (e) {
        next(e);
      }
    };
  
  const createCourseSkills =
    async (req, res, next) => {
      try {
        console.log('deleting all CourseSkills');
        await CourseSkill.deleteMany({});
        const courses = await Course.find({});
        for (let c of courses) {
          console.log(c.name);
          let skills = await Skill.find({courseId: c._id});
          for (let s of skills) {
            const courseSkillData = {
              courseId: c._id,
              skillId: s._id,
              createdAt: new Date(),
            }
            let courseSkill = new CourseSkill(courseSkillData);
            await courseSkill.save();
          }
        }
        next();
      } catch (e) {
        console.log(`error in createCourseSkills: ${e}`);
        next(e);
      }
    };
  
// this route is used to initialize the database to version 1.0.0
  app.get('/upgrade_v1_0_0/',
            isAdmin,
            updateToVersion("1.0.0"),
            (req,res,next) => {
                res.send("upgraded to v1.0.0");
            }
            );

  /*
  this creates the PsetProblem collection
  and it sets all of the problems to have mimeType="plain"
  unless they already have a mimeType.
  This will reset all of the problem mimeTypes to "plain" if called
  a second time.
  */
  app.get('/upgrade_v3_0_0', 
          isAdmin,
          updateProblemMimeType,
          (req,res,next) => {
            res.send("upgraded to v3.0.0");
          }
        );
  
  /*
  this creates the CourseSkill collection by adding every
  skill defined in the course to the CourseSkill collection
  It should only be used to upgrade to v3.1.0 because it will
  delete all of the existing CourseSkill entries including
  skills imported from other courses...
  */
  app.get('/upgrade_v3_1_0', 
          isAdmin,
          createCourseSkills,
          (req,res,next) => {
            res.send("upgraded to v3.1.0");
          }
        )
  
  
//  // All of the following routes are for administrative purposes only
//  // and should be removed from the production version of the app.
//  // They were used to update the database schema during earlier development.
//   app.get("/updateSchema", authorize, isAdmin,
//     async (req, res, next) => {
//     const result = await Problem.updateMany({}, {allowAnswers: true});
//     //console.dir(result)
//     res.redirect("/");
//   });


// // add the studentId to each Review ...
// app.get("/updateReviews", authorize, isAdmin,
//     async (req, res, next) => {
//     if (req.user.googleemail != "tjhickey@brandeis.edu") {
//       res.send("you are not allowed to do this!");
//       //console.log("did we get here???  Yes we did!!")
//       return;
//     } else {
//       res.send("we aren't doing this anymore!");
//       //console.log("did we get here???  Yes we did!!")
//       return;
//       try {
//         let counter = 0;
//         const reviews = await Review.find({});
//         reviews.forEach(async (r) => {
//           // lookup the answer, get the studentId,
//           // and add it to the review, and save it...
//           answer = await Answer.findOne({_id: r.answerId});
//           //console.log(counter+": "+r._id+" "+answer.studentId)
//           counter += 1;
//           r.studentId = answer.studentId;
//           await r.save();
//         });
//       } catch (e) {
//         console.log("caught an error: " + e);
//         console.dir(e);
//       }
//       res.send("all done");
//     }
//   });
  
//   // add the studentId to each Review ...
//   app.get("/updateReviews2", authorize, isAdmin,
//     async (req, res, next) => {
//     if (req.user.googleemail != "tjhickey@brandeis.edu") {
//       res.send("you are not allowed to do this!");
//     } else {
//       try {
//         // for each answer, find all of the reviews of that answer
//         // create the reviewers field of the answer and set it
//         let counter = 0;
//         const answers = await Answer.find({});
//         answers.forEach(async (a) => {
//           try {
//             //  answer, get the studentId,
//             // and add it to the review, and save it...
//             reviews = await Review.find({answerId: a._id});
//             reviewers = reviews.map((r) => r.reviewerId);
//             //console.log(a._id+" "+JSON.stringify(reviewers))
//             a.reviewers = reviewers;
//             await a.save();
//           } catch (e) {
//             console.log("caught an error updating an answer: " + e);
//           }
//         });
//       } catch (e) {
//         console.log("caught an error: " + e);
//         console.dir(e);
//       }
//       res.send("all done");
//     }
//   });
  
//   app.get("/removeGradeSheets", authorize, isAdmin,
//     async (req, res, next) => {
//     if (req.user.googleemail != "tjhickey@brandeis.edu") {
//       res.send("you are not allowed to do this!");
//     } else {
//       try {
//         let counter = 0;
//         const courses = await Course.find({});
//         courses.forEach(async (c) => {
//           // lookup the answer, get the studentId,
//           // and add it to the review, and save it...
//           c.gradeSheet = {};
//           //console.log('updated course :'+JSON.stringify(c))
//           await c.save();
//         });
//       } catch (e) {
//         console.log("caught an error: " + e);
//         console.dir(e);
//       }
//       res.send("all done");
//     }
//   });
  
//   app.get("/removeOrphanAnswers", authorize, isAdmin,
//     async (req, res, next) => {
//     try {
//       if (req.user.googleemail != "tjhickey@brandeis.edu") {
//         res.send("you are not allowed to do this!");
//       } else {
//         /* 
//                 Find all reviews whose answer has been deleted,
//                 and remove those reviews. 
//                 First we find all of the answers and create a list of the AnswerIds
//                 Then we find all reviews whose answer is not in that list.
//                 These are the orphans.
//                 Then we delete those orphan reviews.
//             */
//         console.log("in /removeOrphanAnswers");
//         const answers = await Answer.find({});
//         console.log("num answers is " + answers.length);
//         const answerIds = answers.map((x) => x._id);
//         console.log("num answerIds is " + answerIds.length);
//         const orphans = await Review.find({answerId: {$not: {$in: answerIds}}});
//         console.log("num orphans is " + orphans.length);
//         const orphanIds = orphans.map((x) => x._id);
//         const numrevsBefore = await Review.find().count();
//         await Review.deleteMany({_id: {$in: orphanIds}});
//         const numrevsAfter = await Review.find().count();
//         res.send("before " + numrevsBefore + " after:" + numrevsAfter);
//       }
//     } catch (e) {
//       next(e);
//     }
//   });
  
//   app.get("/updateOfficialReviews", authorize, isAdmin,
//     async (req, res, next) => {
//     if (req.user.googleemail != "tjhickey@brandeis.edu") {
//       res.send("you are not allowed to do this!");
//     } else {
//       try {
//         // iterate through all answers
//         // look for reviews a review by a TA
//         // if found, then use it to update the answer
  
//         let answers = await Answer.find();
//         for (let answer of answers) {
//           let reviews = await Review.find({answerId: answer._id});
//           for (let review of reviews) {
//             let reviewer = await User.findOne({_id: review.reviewerId});
//             if (reviewer && reviewer.taFor && reviewer.taFor.includes(answer.courseId)) {
//               answer.officialReviewId = review._id;
//               answer.points = review.points;
//               answer.review = review.review;
//               answer.skills = review.skills;
//               await answer.save();
//             }
//           }
//         }
//       } catch (e) {
//         console.log("caught an error: " + e);
//         console.dir(e);
//         next(e);
//       }
//       res.send("all done");
//     }
//   });
  
  
module.exports = app;
