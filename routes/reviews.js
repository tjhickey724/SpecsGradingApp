/*     routes/reviews.js

These routes handle the peer review and grading features of the app.
See the README.md file for a discussion of the algorithm. The key idea
is we want to fairly assign answers to be reviewed and so we need 
to update the following fields 

problem.pendingReviews [{answerId,reviewerId,createdAt}]
answer.numReviews (including both completed and pending)
answer.reviewers [reviewerId]

A user can either directly grade a specified students answer to a problem
which is fairly simple)
or they can request to grade an answer to a problem.

In the former case, the route specifies a problem and student id.
If the specified user has answered that problem, then the route
renders a view with that problem and answer and generates a form
where the reviewer can complete and submit their review.
It also updates both the problem and the answer to indicate that the
reviewer will potentially submit a review. Thus the list of pending
reviewers for answers to the problem is stored in the problem (along
  with the answerId, reviewerId, and createdAt time) and the answer
  itself has a list of the reviewerIds of pending reviewers, as well
  as a list of the reviewers that have completed their reviews.

When a user submits a review, their id is added to the answer.reviewers list
and removed from the answer.pendingreviewers list

Also their entry in the problem is removed.

One complication is that they system will remove expired pending reviews.
In this case, if the user does eventually submit a review, then the system
will attempt to remove their pendingReviewer information, but it won't be there.
This shouldn't create any kind of problem. The one issue is that it would allow
a user to create two or more reviews of the same answer by expiring one or more
reviews and then submitting them.
We should probably check for this and refuse to accept the new review,
or replace the old review with the new review..

The latter case is where all of the complexity lies.
The system attempts to find an answer with the fewest reviews (easy)
but also keeps track of pending reviews so that it fairly distributes problems
to the class.

In the latter case, the system finds an answer with the fewest reviews
(actual + pending) that the user has not already reviewed and whose review
is not pending.

NOTES:
Does this allow a user to review an answer twice?
Also /saveReview is probably cruft, replaced with /saveReview2
and the latter still uses .save() when it should be using .findByIdAndUpdate
and it should probably use $pull instead of $set.
Indeed, $set is dangerous in this context ...

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
      // a more reasonable number would be 10-20 minutes
      // or we could be ambitious and keep track of the average
      // time to review the problem and use an adaptive timeout,
      // but let's do that later!

      const tooOld = new Date().getTime() - 1 *1000; // 1 second
      let expiredReviews = [];
      let pendingReviews = problem.pendingReviews.filter((x) => {
        if (x.timeSent < tooOld) {
          expiredReviews.push(x);
          return false;
        } else {
          return true;
        }
      });
      // we should try to use a $pull instead of $set
      // but first lets see if this works....
      // and I'll set the timeout to be relatively short

      if (expiredReviews.length>0){
        await Problem.findByIdAndUpdate(problem._id,
          {$pullAll:{pendingReviews:expiredReviews}});
      }
      
  
      // next we use the expiredReviews from the problem object
      // to update the numReviews and pendingReviewers fields of the answers

      expiredReviews.forEach(async function (x) {
        // remove the reviewerId from the list of pendingReviewers
        // and decrement the optimistic numReview field
        // pendingReviews has form x = {answerId,reviewerId,timeSent}

        let tempAnswer = await Answer.findOne({_id: x.answerId});
        let expiredReviewers =  tempAnswer.pendingReviewers.filter((r) => {
          return (r.equals(x.reviewerId))     
        });
        // this will update the answer by removing the pendingReviewer
        // but we really should use pull all.
        // I'll test this first and then make the change and test it.
        await Answer.findByIdAndUpdate(tempAnswer._id,
          {$inc:{numReviews:-expiredReviewers.length},
           $pullAll:{pendingReviewers:expiredReviewers}})

        // await Answer.findByIdAndUpdate(tempAnswer._id,
        //       {$set:{numReviews:tempAnswer.numReviews,
        //               pendingReviewers:tempAnswer.pendingReviewers }});

      });


      // Here we set up the local variables we'll need for rendering:
      //
      res.locals.student = {googlename: "", googleemail: ""};
      res.locals.problem = problem;
      res.locals.alreadyReviewed = false;
      res.locals.numReviewsByMe = await Review.find({problemId: problem._id, reviewerId: req.user._id}).count();
 

      // next, we look to see if there is an answer which the user is already
      // supposed to be reviewing, i.e. the user is a pendingReviewer
      // if there is such an answer then we return that one to the user.

      let answer = await Answer.findOne({problemId:probId,pendingReviewers:req.user._id});
      if (answer) {
        // send the user the review they were already assigned!
        res.redirect("/showReviewsOfAnswer/" + answer._id);
      } else {
        // the user has not yet been assigned an answer for this problem
        // next, we find all answers to this Problem, sorted by numReviews
        let answers = await Answer.find({problemId: probId}).sort({numReviews: "asc"});
    
        // find first answer not already reviewed by the user
        let i = 0;
        answer = null;
        while (i < answers.length) {
          answer = answers[i];
          //console.log(`user=${req.user._id}`)
          //console.log(`answers[${i}] = ${JSON.stringify(answer)}`)
          if (!answer.reviewers.find((x) => x.equals(req.user._id)) ) {
            // we found an answer the user hasn't reviewed!
            //answer.numReviews += 1; // we optimistically add 1 to numReviews
            //answer.pendingReviewers.push(req.user._id);
            //answer.markModified("pendingReviewers");
            //await answer.save();

            // I should use $incr and $push for this one, 
            // instead of $set by itself ***
            //await Answer.findByIdAndUpdate(answer._id,
            //    {$set:{numReviews:answer.numReviews, pendingReviewers:answer.pendingReviewers}})
            await Answer.findByIdAndUpdate(answer._id,
                {$inc:{numReviews:1},
                 $push:{pendingReviewers:req.user._id}})
  
            // {answerId,reviewerId,timeSent}
            //problem.pendingReviews.push({answerId: answer._id, reviewerId: req.user._id, timeSent: new Date().getTime()});
            //problem.markModified("pendingReviews");
            //await problem.save();

            // also use $push for this one ****
            //await Problem.findByIdAndUpdate(problem._id,
            //    {$set:{pendingReviews:problem.pendingReviews}})
            let review = {answerId: answer._id, 
                          reviewerId: req.user._id, 
                          timeSent: new Date().getTime()};
            await Problem.findByIdAndUpdate(problem._id,
                    {$push:{pendingReviews:review}});
            break;
          } else {
            //console.log("reviewed this one!")
            answer = null;
          }
          i++;
        }
    
        
        //res.render("reviewAnswer")
    
        // get the skills for this problem
    
        if (answer) {
          res.locals.routeName = " showReviewsOfAnswer";
          res.redirect("/showReviewsOfAnswer/" + answer._id);
        } else {
          // this is the case where there is nothing left for the user to review
          res.locals.routeName = " reviewAnswer";
          // replace this with a call to "reviewsCompleted" ***
          res.send('nothing to review');
          //res.render("reviewAnswer");
        }
      }
    } catch (e) {
      next(e);
    }
  });





/*
 this is the route for writing a review of a particular student's answer to a problem
 this is what TAs do when grading a problem set
*/
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

    // *** Handle the case where the user hasn't answered this one yet.
    // need a new view "noAnswerToReview"  ***
    if (answer) {
      res.redirect("/showReviewsOfAnswer/" + answer._id);
    } else {
      // this is ugly and I'll need to fix it soon
      res.send("the user has not yet submitted an answer to this problem")
      //res.locals.routeName = " reviewAnswer";
      //res.render("reviewAnswer");
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
    "/saveReview2/:probId/:answerId",
  
    async (req, res, next) => {
      try {

        const problem = await Problem.findOne({_id: req.params.probId});
        const answer = await Answer.findOne({_id: req.params.answerId});
  
        let skills = req.body.skill;
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
        // the official review and save it in the collection
        if (req.user.taFor.includes(problem.courseId)) {
          // answer.officialReviewId = newReviewDoc._id;
          // answer.review = req.body.review;
          // answer.points = req.body.points;
          // answer.skills = skills;
          // await answer.save()
          await Answer.findByIdAndUpdate(answer._id,
            {$set:{officialReviewId:newReviewDoc._id,
                   review: req.body.review,
                   points: req.body.points,
                   skills: req.body.skills
              }})
        }
  
        // update the pendingReviews field of the corresponding problem document

        for (let i = 0; i < problem.pendingReviews.length; i++) {
          reviewInfo = problem.pendingReviews[i];
          if (reviewInfo.answerId.equals(answer._id) 
            && reviewInfo.reviewerId.equals(req.user._id)) {
            await Problem.findByIdAndUpdate(problem._id, 
                {$pull:{pendingReviews:reviewInfo}})
          } 
        }
        
        // next we update the reviewers info in the answer document
        // if this was a pending review, then 
        // remove the userId from pendingReviewers
        // and add userId to the reviewers list
        if (answer.pendingReviewers.find(
               (x) => x.equals(req.user._id)) ) {
          await Answer.findByIdAndUpdate(answer._id,
            {$push:{reviewers:req.user._id},
             $pull:{pendingReviewers:req.user._id}});
          }
        else {
          // otherwise, we have to add 1 to numReviews and push the userId to reviewers
          await Answer.findByIdAndUpdate(answer._id,
            {$inc:{numReviews:1},$push:{reviewers:req.user._id}});

        }
  
       
        if (req.body.destination == "submit and view this again") {
          res.redirect("/showReviewsOfAnswer/" + req.params.answerId);
        } else {
          res.redirect("/reviewAnswers/" + problem._id);
        }

      } catch (e) {
        next(e);
      }
    }
  );
  
  app.post("/removeReviews", async (req, res, next) => {
    try {
      /*
        We need to remove/delete the Review, but also
        to remove the reviewerId from the list of reviewers
        for the answer...
        Currently this is only called with a single review to delete
        but the router can delete multiple reviews for single answer
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
  
      let answerId = reviews[0].answerId;
      let reviewerIds = reviews.map((r) => r.reviewerId);
      let answer = await Answer.findOne({_id: answerId});
  

      //const newReviewerIds = removeElements(answer.reviewers, reviewerIds);
 
      await Answer.findByIdAndUpdate(answerId,
        {$inc:{numReviews:-reviewerIds.length},
         $pullAll:{reviewers:reviewerIds}
        })
      await Review.deleteMany({_id: {$in: deletes}});
      //res.send("just updating answer ...")
      res.redirect("/showReviewsOfAnswer/" + answerId);
    } catch (e) {
      next(e);
    }
  });
  
  // function removeElements(slist, rems) {
  //   for (let i = 0; i < rems.length; i++) {
  //     slist = slist.filter((s) => {
  //       const z = !s.equals(rems[i]);
  //       return z;
  //     });
  //   }
  //   return slist;
  // }
  
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
