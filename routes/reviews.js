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
or they can request to grade a programmatically selected answer to a specified problem.

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

One complication is that the system must remove expired pending reviews.

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
We may want to modify this so that in only takes into account TA reviews
in the case where a problem can be peer reviewed by both students and TAs.
For now, we don't need to do that because exams should not be peer reviewable
by default.

DEV NOTES:
I currenlty need to modify this reviewing code so that it uses the problem
object to store the pendingReviews and not the problem object.
*/

const express = require("express");
const app = express.Router();

// Models!

const Problem = require("../models/Problem");
const Course = require("../models/Course");
const CourseMember = require("../models/CourseMember");
const Answer = require("../models/Answer");
const Review = require("../models/Review");
const User = require("../models/User");
const Skill = require("../models/Skill");
const RegradeRequest = require("../models/RegradeRequest");

// const {method, otherMethod} = require('./myModule.js');
const {isLoggedIn, hasCourseAccess, hasStaffAccess, isOwner, isAdmin, authorize} = require('./authFunctions.js');




/*
  This is the most complex of the routes for reviewing...
  The goal is to find and claim the answers with the fewest reviews
  and to pick one of those and mark it as a pending review.
  We also remove any pending reviews that are "too old"
  The challenge is that this is currently done by updating values
  in the "answer" object but it takes so much time that another
  user could update the answer field and then the ".save()" operation
  generates an error since it is updating an old version of the object.
  The solution we use here is to use the findOneAndUpdate method 
  with the $incr and $pull   operators.
*/

  app.get("/reviewAnswers/:courseId/:psetId/:probId", authorize, hasCourseAccess,
    async (req, res, next) => {

    try {
      const courseId = req.params.courseId; 
      const probId = req.params.probId;  
      const psetId = req.params.psetId;
      res.locals.courseId = courseId;
      res.locals.psetId = psetId;
      res.locals.probId = probId;


      let problem = await Problem.findOne({_id: probId});
  
      //first we remove all pendingReviews that have exceeded
      // the time limit is currently 10 minutes, but could be adjusted
      // e.g. we could be ambitious and keep track of the average
      // time to review the problem and use an adaptive timeout,
      // but let's do that later!

      const tooOld = new Date().getTime() - 1 *1000*60*10; // 10 minutes
      let expiredReviews = [];
      problem.pendingReviews ||= [];
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
        // this will update the answer by removing the 
        // expiredReviewers from the pendingReviewer using $pullAll

        await Answer.findByIdAndUpdate(tempAnswer._id,
          {$inc:{numReviews:-expiredReviewers.length},
           $pullAll:{pendingReviewers:expiredReviewers}})

      });


       

      // next, we look to see if there is an answer which the user is already
      // supposed to be reviewing, i.e. the user is a pendingReviewer
      // if there is such an answer then we return that one to the user.

      let answer = await Answer.findOne({problemId:probId,pendingReviewers:req.user._id});
      if (answer) {
        // send the user the review they were already assigned!
        res.redirect("/showReviewsOfAnswer/" + courseId+"/"+psetId+"/"+answer._id);
      } else {
        // the user has not yet been assigned an answer for this problem
        // next, we find all answers to this Problem, sorted by numReviews
        let answers = await Answer.find({problemId: probId}).sort({numReviews: "asc"});
    
        // find first answer not already reviewed by the user
        let i = 0;
        answer = null;
        while (i < answers.length) {
          answer = answers[i];

          if (!answer.reviewers.find((x) => x.equals(req.user._id)) ) {
            // we found an answer the user hasn't reviewed!

            // update the answer to have the user as a pending reviewer
            await Answer.findByIdAndUpdate(answer._id,
                {$inc:{numReviews:1},
                 $push:{pendingReviewers:req.user._id}})
  

            // update the problem to record this pending review
            let review = {answerId: answer._id, 
                          reviewerId: req.user._id, 
                          timeSent: new Date().getTime()};
            await Problem.findByIdAndUpdate(problem._id,
                    {$push:{pendingReviews:review}});
            break;
          } else {
            answer = null;
          }
          i++;
        }
    
        if (answer) {
          // if we find an answer to review, then we redirect the user to that answer
          res.redirect("/showReviewsOfAnswer/"+courseId+"/"+ psetId+"/"+answer._id);
        } else {
          // this is the case where there is nothing left for the user to review
          res.locals.routeName = " nothingToReview";
          // Here we set up the local variables we'll need for rendering:
          res.locals.problem = problem;
          res.render('nothingToReview');
        }
      }
    } catch (e) {
      next(e);
    }
  });

/*
 this is the route for recording that a student didn't answer a question
*/
app.get("/gradeProblemWithoutAnswer/:courseId/:psetId/:probId/:studentId", authorize, hasStaffAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const probId = req.params.probId;
    const psetId = req.params.psetId;
    const studentId = req.params.studentId;

    let problem = await Problem.findOne({_id: probId});

    const answers = await Answer.find({studentId: studentId, problemId: probId});

    if (!answers){
      res.send("this user already has answered the question")
    }else {
      let answer = await Answer.findOne({problemId: probId, studentId: studentId});
      let newAnswer = new Answer({
        studentId: studentId,
        courseId: problem.courseId,
        psetId: problem.psetId,
        problemId: problem._id,
        answer: "no answer",
        reviewers: [],
        numReviews: 0,
        pendingReviewers: [],
        createdAt: new Date(),
      });

      await newAnswer.save();
      
      res.redirect('/gradeProblem/'+courseId+"/"+psetId+"/"+probId+"/"+studentId)
    }
  } catch (e) {
      next(e);
  }
   
})



/*
 this is the route for writing a review of a particular student's answer to a problem
 this is what TAs do when grading a problem set
*/
 app.get("/gradeProblem/:courseId/:psetId/:probId/:studentId", authorize, hasCourseAccess,
  async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const psetId = req.params.psetId;
    const probId = req.params.probId;
    const studentId = req.params.studentId;

    let problem = await Problem.findOne({_id: probId});
    res.locals.student = await User.findOne({_id: studentId});

    let answer = await Answer.findOne({problemId: probId, studentId: studentId});


    res.locals.answer = answer;
    res.locals.problem = problem;

    let myReviews = [];
    if (answer != undefined) {
      myReviews = await Review.find({problemId: problem._id, answerId: answer._id, reviewerId: req.user._id});
    }
    res.locals.numReviewsByMe = myReviews.length;
    res.locals.alreadyReviewed = myReviews.length > 0;



    // *** Handle the case where the user hasn't answered this one yet.
    // need a new view "noAnswerToReview"  ***
    if (answer) {
      res.redirect("/showReviewsOfAnswer/" + courseId+"/"+psetId+"/"+answer._id);
    } else {
      // this is ugly and I'll need to fix it soon
      res.send("the user has not yet submitted an answer to this problem")

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
  app.post("/saveReview2/:courseId/:psetId/:probId/:answerId",authorize, hasCourseAccess,
  
    async (req, res, next) => {
      try {
        const courseId = req.params.courseId;
        const psetId = req.params.psetId;
        const probId = req.params.probId;
        const answerId = req.params.answerId;
  
  
        const problem = await Problem.findOne({_id: probId});
  
        const answer = await Answer.findOne({_id: answerId});

        const courseInfo = await Course.findOne({_id: courseId});
  
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
          points: skills.length, //req.body.points,
          skills: skills,
          upvoters: [],
          downvoters: [],
          createdAt: new Date(),
        });
  
        const newReviewDoc = await newReview.save();

        let userIsOwner = req.user._id.equals(courseInfo.ownerId);
  
        // if the user is a TA, then make their review
        // the official review
        if (userIsOwner || req.user.taFor.includes(courseId)) {
    
          
          await Answer.findByIdAndUpdate(answer._id,
            {$set:{officialReviewId:newReviewDoc._id,
                  review: req.body.review,
                  points: req.body.points,
                  skills: skills}});      
          
        }

  
        // next we update the reviewers info in the answer object

        await Answer.findByIdAndUpdate(answer._id,
          {$inc:{numReviews:1},$push:{reviewers:req.user._id}});

        // but we need to adjust numreviews and pendingReviewers
        // if this was a pending review

        if (answer.pendingReviewers.find(
               (x) => x.equals(req.user._id)) ) {
          await Answer.findByIdAndUpdate(answer._id,
            {$inc:{numReviews:-1},
             $pull:{pendingReviewers:req.user._id}});
          }
  
 
        // redid this using $incr and $pull ***
        let pendingReviews = [];
        for (let i = 0; i < problem.pendingReviews.length; i++) {
          reviewInfo = problem.pendingReviews[i];
  
          if (reviewInfo.answerId.equals(answer._id) 
            && reviewInfo.reviewerId.equals(req.user._id)) {
            // don't push answer just reviewed by this user back into pendingReviews
            // this update didn't work 
            await Problem.findByIdAndUpdate(problem._id, 
               {$pull:{pendingReviews:reviewInfo}})
          } 
          else {
             pendingReviews.push(reviewInfo);
          }
        }


        if (req.body.destination == "submit and view this again") {
          res.redirect("/showReviewsOfAnswer/" + courseId+"/"+psetId+"/"+answerId);
        } else {
          res.redirect("/reviewAnswers/" +courseId+"/" +  psetId+"/"+probId);
        }
  
        // we can now redirect them to review more answers
        // res.redirect('/reviewAnswers/'+req.params.probId)
      } catch (e) {
        next(e);
      }
    }
  );
  

  /*
  I want to get rid of this route and not remove any reviews.
  We should just keep a chain or reviews and not allow users to remove them.
  For now, I'll leave this and ignore it. 
  */
  app.post("/removeReviews/:courseId", authorize, hasCourseAccess,
    async (req, res, next) => {
    try {
      /*
        We need to remove/delete the Review, but also
        to remove the reviewerId from the list of reviewers
        for the answer...
        */
      let deletes = req.body.deletes;

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
  

      const newReviewerIds = removeElements(answer.reviewers, reviewerIds);
 

      // try to use $pull instead of .save() ***
      answer.reviewers = newReviewerIds;
      await answer.save();
      await Review.deleteMany({_id: {$in: deletes}});
      //res.send("just updating answer ...")
      res.redirect(
        "/showReviewsOfAnswer/"
        +answer.courseId +"/"
        +answer.psetId +"/"
        +answerId);
  
    } catch (e) {
      next(e);
    }
  });
  
  function removeElements(slist, rems) {
    for (let i = 0; i < rems.length; i++) {
      slist = slist.filter((s) => {
        const z = !s.equals(rems[i]);
        return z;
      });
    }
    return slist;
  }
  
  app.get("/showReviewsOfAnswer/:courseId/:psetId/:answerId", authorize, hasCourseAccess,
    async (req, res, next) => {
    try {
      const courseId = req.params.courseId;
      res.locals.courseId = courseId;

      const psetId = req.params.psetId;
      res.locals.psetId = psetId;

      const answerId = req.params.answerId;
      res.locals.answerId = answerId;

      const id = req.params.answerId;
      
      const answer = await Answer.findOne({_id: answerId});
      res.locals.answer = answer;
      res.locals.courseInfo = await Course.findOne({_id: courseId});
      const problem = await Problem.findOne({_id: answer.problemId});
      res.locals.problem = problem;
      res.locals.student = await User.findOne({_id: answer.studentId});
      res.locals.reviews = await Review.find({answerId: answerId}).populate('reviewerId').populate('skills').sort({points: "asc", review: "asc"});
      const taList = await User.find({taFor: courseId});
      res.locals.taList = taList.map((x) => x._id);
  

  
      res.locals.skills = await Skill.find({_id: {$in: problem.skills}});
      res.locals.allSkills = await Skill.find({courseId: answer.courseId});
      res.locals.regradeRequests = await RegradeRequest.find({answerId: answerId});
  
      res.locals.routeName = " showReviewsOfAnswer";
      if (res.locals.isStaff) {
        res.render("showReviewsOfAnswer");
      } else {
        res.locals.review 
          = await Review
                  .findOne({_id: answer.officialReviewId})
                  .populate('skills');
        if (!res.locals.review) {
          res.locals.review = {review: "no review yet!", points: 0, skills: []};
        }
        res.render("showReviewsOfAnswerToStudent");
      }
    } catch (e) {
      next(e);
    }
  });

  app.get("/showReviewsByUser/:courseId/:psetId/:probId", authorize, hasCourseAccess,
    async (req, res, next) => {
    const probId = req.params.probId;
    res.locals.probId = probId;
    const courseId = req.params.courseId;
    res.locals.courseId = courseId;
    const psetId = req.params.psetId;
    res.locals.psetId = psetId;

    res.locals.problem = await Problem.findOne({_id: probId});
    res.locals.course = await Course.findOne({_id: res.locals.problem.courseId});
    res.locals.usersReviews = await Review.find({reviewerId: req.user._id, problemId: probId});
    res.locals.allReviews = await Review.find({problemId: probId});
    const answerIds = res.locals.usersReviews.map((r) => r.answerId);
    res.locals.usersReviewedAnswers = await Answer.find({_id: {$in: answerIds}});
    res.locals.routeName = " showReviewsByUser";
    res.render("showReviewsByUser");
  });
  
  
  
  
module.exports = app;
