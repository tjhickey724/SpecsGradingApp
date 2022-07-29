// this router handles the reviewing of answers
// and everything related to reviews

/*
there is a lot of "cruft" in this code that needs to be cleaned up
*/

const express = require("express");
const app = express.Router();

// Models!

const Problem = require("../models/Problem");
const Answer = require("../models/Answer");
const Review = require("../models/Review");
const User = require("../models/User");
const Skill = require("../models/Skill");
const RegradeRequest = require("../models/RegradeRequest");

/*
  This is the most complex of the routes for reviewing...
  The goal is to find and claim the answers with the fewest reviews
  and to pick one of those and mark it as a pending review.
  We also remove any pending reviews that are "too old"
  The challenge is that this is currently done by updating values
  in the "answer" object but it takes so much time that another
  user could update the answer field and then the ".save()" operation
  generates an error since it is updating an old version of the object.
  One solution is to use the findOneAndUpdate method with the $incr and $pull
  operators ... but I don't know if $pull works for objects ....
*/

  app.get("/reviewAnswers/:probId", async (req, res, next) => {
    try {
      const probId = req.params.probId;
      let problem = await Problem.findOne({_id: probId});
  
      //first we remove all pendingReviews that have exceeded
      // the time limit of 60 secs = 60,000 ms
      // 60 is a magic number and should be moved up somewhere...
      const tooOld = new Date().getTime() - 60 * 1000;
      let expiredReviews = [];
      let pendingReviews = problem.pendingReviews.filter((x) => {
        if (x.timeSent < tooOld) {
          expiredReviews.push(x);
          //console.log("\nremoved an expired review ")
          //console.dir(x)
  
          return false;
        } else {
          return true;
        }
      });
      problem.pendingReviews = pendingReviews;
      problem.markModified("pendingReviews");
      await problem.save();
  
      expiredReviews.forEach(async function (x) {
        // remove the reviewerId from the list of pendingReviewers
        // and decrement the optimistic numReview field
        // pendingReviews has form x = {answerId,reviewerId,timeSent}
        let tempAnswer = await Answer.findOne({_id: x.answerId});
        tempAnswer.pendingReviewers = tempAnswer.pendingReviewers.filter((r) => {
          if (r.equals(x.reviewerId)) {
            tempAnswer.numReviews -= 1;
            //console.log("\nremoved reviewer '+r+' from pending reviews: ")
            //console.dir(x)
            return false;
          } else {
            //console.log('not removing '+r+' from pending reviewers')
            return true;
          }
        });
        tempAnswer.markModified("pendingReviewers");
        await tempAnswer.save();
      });
  
      // next, we find all answers to this Problem, sorted by numReviews
      let answers = await Answer.find({problemId: probId}).sort({numReviews: "asc"});
  
      // find first answer not already reviewed or being reviewed by user
      let i = 0;
      let answer = null;
      while (i < answers.length) {
        answer = answers[i];
        //console.log(`user=${req.user._id}`)
        //console.log(`answers[${i}] = ${JSON.stringify(answer)}`)
        if (!answer.reviewers.find((x) => x.equals(req.user._id)) && !answer.pendingReviewers.find((x) => x.equals(req.user._id))) {
          // we found an answer the user hasn't reviewed!
          answer.numReviews += 1; // we optimistically add 1 to numReviews
          answer.pendingReviewers.push(req.user._id);
          answer.markModified("pendingReviewers");
          await answer.save();
  
          // {answerId,reviewerId,timeSent}
          problem.pendingReviews.push({answerId: answer._id, reviewerId: req.user._id, timeSent: new Date().getTime()});
  
          problem.markModified("pendingReviews");
  
          await problem.save();
          break;
        } else {
          //console.log("reviewed this one!")
          answer = null;
        }
        i++;
      }
  
      // and we need to add it to the problem.pendingReviews
      res.locals.answer = answer;
      res.locals.student = {googlename: "", googleemail: ""};
      res.locals.problem = problem;
      res.locals.alreadyReviewed = false;
      res.locals.numReviewsByMe = await Review.find({problemId: problem._id, reviewerId: req.user._id}).length;
  
      //res.render("reviewAnswer")
  
      // get the skills for this problem
  
      if (answer) {
        res.redirect("/showReviewsOfAnswer/" + answer._id);
      } else {
        res.locals.routeName = " reviewAnswer";
        res.render("reviewAnswer");
      }
    } catch (e) {
      next(e);
    }
  });





// this is the route for writing a review of a particular student's answer to a problem
app.get("/gradeProblem/:probId/:studentId", async (req, res, next) => {
  try {
    const probId = req.params.probId;
    const studentId = req.params.studentId;

    let problem = await Problem.findOne({_id: probId});
    res.locals.student = await User.findOne({_id: studentId});

    let answer = await Answer.findOne({problemId: probId, studentId: studentId});

    //console.log("answer= "+JSON.stringify(answer))
    // and we need to add it to the problem.pendingReviews
    res.locals.answer = answer;
    res.locals.problem = problem;

    let myReviews = [];
    if (answer != undefined) {
      myReviews = await Review.find({problemId: problem._id, answerId: answer._id, reviewerId: req.user._id});
    }
    res.locals.numReviewsByMe = myReviews.length;
    res.locals.alreadyReviewed = myReviews.length > 0;

    //console.log('\n\n\nmy reviews='+JSON.stringify(myReviews))
    //console.log(res.locals.numReviewsByMe)
    if (true || res.locals.alreadyReviewed) {
      res.redirect("/showReviewsOfAnswer/" + answer._id);
    } else {
      res.locals.routeName = " reviewAnswer";
      res.render("reviewAnswer");
    }
  } catch (e) {
    next(e);
  }
});



  
  /*  saveReview
      when we save a review we need to create a new review document
      but also update the corresponding answer and problem documents
      to store the new information about number of reviews and pending reviews
      This is used when we generate an answer for a user to review
    */
  app.post(
    "/saveReview/:probId/:answerId",
  
    async (req, res, next) => {
      try {
        console.log("in saveReview");
        console.dir(req.body);
  
        const problem = await Problem.findOne({_id: req.params.probId});
  
        const answer = await Answer.findOne({_id: req.params.answerId});
  
        const newReview = new Review({
          reviewerId: req.user._id,
          courseId: problem.courseId,
          psetId: problem.psetId,
          problemId: problem._id,
          answerId: req.params.answerId,
          studentId: answer.studentId,
          review: req.body.review,
          points: req.body.points,
          upvoters: [],
          downvoters: [],
          createdAt: new Date(),
        });
  
        await newReview.save();
  
        // next we update the reviewers info in the answer object
        answer.reviewers.push(req.user._id);
        answer.numReviews += 1;
  
        let pendingReviewers = [];
  
        for (let i = 0; i < answer.pendingReviewers.length; i++) {
          const reviewer = answer.pendingReviewers[i];
  
          if (reviewer.equals(req.user._id)) {
            answer.numReviews -= 1;
  
            // because we incremented it when we sent the review to user
          } else {
            pendingReviewers.push(reviewer);
          }
        }
        answer.pendingReviewers = pendingReviewers;
        answer.markModified("pendingReviewers");
  
        await answer.save();
  
        // finally we update the pendingReviews field of the problem
        // to remove this reviewer on this answer, if necessary
        // the reviewInfo might have been removed earlier if they
        // timed out before completing their review...
        let pendingReviews = [];
        for (let i = 0; i < problem.pendingReviews.length; i++) {
          reviewInfo = problem.pendingReviews[i];
  
          if (reviewInfo.answerId.equals(answer._id) && reviewInfo.reviewerId.equals(req.user._id)) {
            // don't push answer just reviewed by this user back into pendingReviews
          } else {
            pendingReviews.push(reviewInfo);
          }
        }
  
        problem.pendingReviews = pendingReviews;
  
        problem.markModified("pendingReviews");
  
        await problem.save();
  
        res.redirect("/showReviewsOfAnswer/" + answer._id);
        // we can now redirect them to review more answers
        // res.redirect('/reviewAnswers/'+req.params.probId)
      } catch (e) {
        next(e);
      }
    }
  );
  
  /*  saveReview
    when we save a review we need to create a new review document
    but also update the corresponding answer and problem documents
    to store the new information about number of reviews and pending reviews
    This is used when we generate an answer for a user to review
  */
  app.post(
    "/saveReview2/:probId/:answerId",
  
    async (req, res, next) => {
      try {
        console.log("in saveReview2");
        console.dir(req.body);
        console.dir(req.headers);
        console.dir(req.method);
  
        const problem = await Problem.findOne({_id: req.params.probId});
  
        const answer = await Answer.findOne({_id: req.params.answerId});
  
        let skills = req.body.skill;
        console.log("skills=" + JSON.stringify(skills));
        console.log("typeof(skills=" + typeof skills);
        if (typeof skills == "undefined") {
          skills = [];
        } else if (typeof skills == "string") {
          skills = [skills];
        }
  
        const newReview = new Review({
          reviewerId: req.user._id,
          courseId: problem.courseId,
          psetId: problem.psetId,
          problemId: problem._id,
          answerId: req.params.answerId,
          studentId: answer.studentId,
          review: req.body.review,
          points: req.body.points,
          skills: skills,
          upvoters: [],
          downvoters: [],
          createdAt: new Date(),
        });
  
        const newReviewDoc = await newReview.save();
  
        // if the user is a TA, then make their review
        // the official review
        if (req.user.taFor.includes(problem.courseId)) {
          answer.officialReviewId = newReviewDoc._id;
          answer.review = req.body.review;
          answer.points = req.body.points;
          answer.skills = skills;
        }
  
        // next we update the reviewers info in the answer object
        answer.reviewers.push(req.user._id);
        answer.numReviews += 1;
  
        let pendingReviewers = [];
  
        for (let i = 0; i < answer.pendingReviewers.length; i++) {
          const reviewer = answer.pendingReviewers[i];
  
          if (reviewer.equals(req.user._id)) {
            answer.numReviews -= 1;
  
            // because we incremented it when we sent the review to user
          } else {
            pendingReviewers.push(reviewer);
          }
        }
        answer.pendingReviewers = pendingReviewers;
        answer.markModified("pendingReviewers");
  
        await answer.save();
  
        // finally we update the pendingReviews field of the problem
        // to remove this reviewer on this answer, if necessary
        // the reviewInfo might have been removed earlier if they
        // timed out before completing their review...
        let pendingReviews = [];
        for (let i = 0; i < problem.pendingReviews.length; i++) {
          reviewInfo = problem.pendingReviews[i];
  
          if (reviewInfo.answerId.equals(answer._id) && reviewInfo.reviewerId.equals(req.user._id)) {
            // don't push answer just reviewed by this user back into pendingReviews
          } else {
            pendingReviews.push(reviewInfo);
          }
        }
  
        problem.pendingReviews = pendingReviews;
  
        problem.markModified("pendingReviews");
  
        await problem.save();
  
        //res.redirect('/showReviewsOfAnswer/'+answer._id)
        if (req.body.destination == "submit and view this again") {
          res.redirect("/showReviewsOfAnswer/" + req.params.answerId);
        } else {
          res.redirect("/reviewAnswers/" + problem._id);
        }
  
        // we can now redirect them to review more answers
        // res.redirect('/reviewAnswers/'+req.params.probId)
      } catch (e) {
        next(e);
      }
    }
  );
  
  app.post("/removeReviews", async (req, res, next) => {
    try {
      /*
        We need to remove delete the Review, but also
        to remove the reviewerId from the list of reviewers
        for the answer...
        */
      let deletes = req.body.deletes;
      //console.log(`deletes=${deletes}`)
      //console.log(`type(deletes)=${typeof(deletes)}`)
      let reviews = null;
  
      if (!deletes) {
        res.send("nothing to delete");
        return;
      } else if (typeof deletes == "string") {
        let review = await Review.findOne({_id: deletes});
        reviews = [review];
      } else {
        reviews = await Review.find({_id: {$in: deletes}});
      }
      //console.log("reviews="+JSON.stringify(reviews))
      let answerId = reviews[0].answerId;
      let reviewerIds = reviews.map((r) => r.reviewerId);
      let answer = await Answer.findOne({_id: answerId});
  
      //console.log(`answer= ${JSON.stringify(answer)}`)
      //console.log(`answer.reviewers=${JSON.stringify(answer.reviewers)}`)
      //console.log(`reviewerIds= ${JSON.stringify(reviewerIds)}`)
      //console.log(answer.reviewers.indexOf(reviewerIds[0]))
      const newReviewerIds = removeElements(answer.reviewers, reviewerIds);
      //console.log('nri = '+JSON.stringify(newReviewerIds))
      answer.reviewers = newReviewerIds;
      await answer.save();
      await Review.deleteMany({_id: {$in: deletes}});
      //res.send("just updating answer ...")
      res.redirect("/showReviewsOfAnswer/" + answerId);
    } catch (e) {
      next(e);
    }
  });
  
  function removeElements(slist, rems) {
    for (let i = 0; i < rems.length; i++) {
      slist = slist.filter((s) => {
        const z = !s.equals(rems[i]);
        //console.log(`${s} ${rems[i]} ${z}`)
        return z;
      });
      //console.log(`${i}  ${JSON.stringify(slist)}`)
    }
    return slist;
  }
  
  app.get("/showReviewsOfAnswer/:answerId", async (req, res, next) => {
    try {
      const id = req.params.answerId;
      res.locals.answer = await Answer.findOne({_id: id});
      res.locals.problem = await Problem.findOne({_id: res.locals.answer.problemId});
      res.locals.student = await User.findOne({_id: res.locals.answer.studentId});
      res.locals.reviews = await Review.find({answerId: id}).sort({points: "asc", review: "asc"});
      const taList = await User.find({taFor: res.locals.problem.courseId});
      res.locals.taList = taList.map((x) => x._id);
  
      for (rev of res.locals.reviews) {
        rev.fullskills = await Skill.find({_id: {$in: rev.skills}});
        for (x of rev.fullskills) {
          console.log(x["name"]);
        }
      }
  
      res.locals.skills = await Skill.find({_id: {$in: res.locals.problem.skills}});
      res.locals.allSkills = await Skill.find({courseId: res.locals.answer.courseId});
      res.locals.regradeRequests = await RegradeRequest.find({answerId: id});
  
      res.locals.routeName = " showReviewsOfAnswer";
      res.render("showReviewsOfAnswer");
    } catch (e) {
      next(e);
    }
  });

  app.get("/showReviewsByUser/:probId", async (req, res, next) => {
    const id = req.params.probId;
    res.locals.problem = await Problem.findOne({_id: id});
    res.locals.usersReviews = await Review.find({reviewerId: req.user._id, problemId: res.locals.problem._id});
    res.locals.allReviews = await Review.find({problemId: res.locals.problem._id});
    const answerIds = res.locals.usersReviews.map((r) => r.answerId);
    res.locals.usersReviewedAnswers = await Answer.find({_id: {$in: answerIds}});
    res.locals.routeName = " showReviewsByUser";
    res.render("showReviewsByUser");
  });
  
  app.get("/showReview/:reviewId", (req, res) => res.send("Under Construction"));
  
  
module.exports = app;
