var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
// require the socket.io module

// Models!
const Course = require('./models/Course' );
const ProblemSet = require('./models/ProblemSet' );
const Problem = require('./models/Problem' );
const Answer = require('./models/Answer')
const Review = require('./models/Review')
const User = require('./models/User')
const CourseMember = require('./models/CourseMember')

//const mongoose = require( 'mongoose' );
//const ObjectId = mongoose.Schema.Types.ObjectId;



//var apikey = require('./config/apikey');

// AUTHENTICATION MODULES
session = require("express-session"),
bodyParser = require("body-parser"),
flash = require('connect-flash')

const MongoStore = require('connect-mongo')(session)

// END OF AUTHENTICATION MODULES

const mongoose = require( 'mongoose' );

mongoose.connect( 'mongodb://localhost/pra_V2_0', { useNewUrlParser: true } );
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log("we are connected!!!")
});


// Authentication
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
// here we set up authentication with passport
const passport = require('passport')
const configPassport = require('./config/passport')
configPassport(passport)


var app = express();

var http = require('http').Server(app);
var io = require('socket.io')(http);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));



/*************************************************************************
     HERE ARE THE AUTHENTICATION ROUTES
**************************************************************************/

//app.use(session({ secret: 'zzbbyanana',resave: false,  saveUninitialized: false }));
app.use(session(
  {secret: 'zzbbyanana',
   resave: false,
   saveUninitialized: false,
   store:new MongoStore({mongooseConnection: mongoose.connection})}))
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.urlencoded({ extended: false }));



const approvedLogins = ["tjhickey724@gmail.com","csjbs2018@gmail.com"];

// here is where we check on their logged in status
app.use((req,res,next) => {
  res.locals.title="Peer Review App"
  res.locals.loggedIn = false
  if (req.isAuthenticated()){
      res.locals.user = req.user
      res.locals.loggedIn = true
    }
  else {
    res.locals.loggedIn = false
  }
  next()
})



// here are the authentication routes

app.get('/loginerror', function(req,res){
  res.render('loginerror',{})
})

app.get('/login', function(req,res){
  res.render('login',{})
})



// route for logging out
app.get('/logout', function(req, res) {
        req.session.destroy((error)=>{console.log("Error in destroying session: "+error)});
        req.logout();
        res.redirect('/');
    });


// =====================================
// GOOGLE ROUTES =======================
// =====================================
// send to google to do the authentication
// profile gets us their basic information including their name
// email gets their emails
app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));


app.get('/login/authorized',
        passport.authenticate('google', {
                successRedirect : '/',
                failureRedirect : '/loginerror'
        })
      );


// route middleware to make sure a user is logged in
function isLoggedIn(req, res, next) {
    res.locals.loggedIn = false
    if (req.isAuthenticated()){
      res.locals.loggedIn = true
      return next();
    } else {
      res.redirect('/login');
    }
}


app.get('/',
    async ( req, res, next ) => {


      if (!req.user) next()

      let coursesOwned =
          await Course.find({ownerId:req.user._id},'name')
      res.locals.coursesOwned = coursesOwned
      res.locals.coursesTAing = []

      let registrations =
          await  CourseMember.find({studentId:req.user._id},'courseId')
      res.locals.registeredCourses = registrations.map((x)=>x.courseId)

      let coursesTaken =
          await Course.find({_id:{$in:res.locals.registeredCourses}},'name')
      res.locals.coursesTaken = coursesTaken

      res.locals.title = "PRA"
      res.render('index');
    }

)

app.use(isLoggedIn)

app.get('/createCourse',
      (req,res) => res.render('createCourse'))

// rename this to /createCourse and update the ejs form
app.post('/createNewCourse',
  async ( req, res, next ) => {
    try {
      let coursePin =  await getCoursePin()
      let newCourse = new Course(
       {
        name: req.body.courseName,
        ownerId: req.user._id,
        coursePin:coursePin,
        createdAt: new Date()
       }
      )

      newCourse.save()
        .then( (a) => {
          res.redirect('/');
        } )
        .catch( error => {
          res.send( error );
        } );
      }
    catch(e){
      next(e)
    }
  }
)

async function getCoursePin(){
  // this only works if there are many fewer than 10000000 courses
  // but that won't be an issue with this alpha version!
  let coursePin =  Math.floor(Math.random()*10000000)
  let lookupPin = await Course.find({coursePin:coursePin},'coursePin')

  while (lookupPin.length>0) {
    coursePin =  Math.floor(Math.random()*10000000)
    lookupPin = await Course.find({coursePin:coursePin},'coursePin')
  }
  return coursePin
}



app.get('/showCourse/:courseId',
  async ( req, res, next ) => {
    try {
      const id = req.params.courseId
      res.locals.courseInfo = await Course.findOne({_id:id},'name coursePin ownerId')

      const memberList = await CourseMember.find({studentId:req.user._id,courseId:res.locals.courseInfo._id})
      res.locals.isEnrolled = (memberList.length > 0)

      res.locals.problemSets = await ProblemSet.find({courseId:res.locals.courseInfo._id})

      res.locals.isTA =
          req.user.taFor &&
          req.user.taFor.includes(res.locals.courseInfo._id)



      res.render('showCourse')
    }
    catch(e){
      next(e)
    }
  }
)




app.post('/joinCourse',
  async (req, res, next ) => {
    try {
      let coursePin = req.body.coursePin


      res.locals.courseInfo =
          await Course.findOne({coursePin:coursePin},'name coursePin ownerId')

      const memberList =
          await CourseMember.find({studentId:req.user._id,courseId:res.locals.courseInfo._id})
      res.locals.isEnrolled = (memberList.length > 0)

      res.locals.problemSets =
          await ProblemSet.find({courseId:res.locals.courseInfo._id})

      let registration =
        {
          studentId: res.locals.user._id,
          courseId: res.locals.courseInfo._id,
          createdAt: new Date(),
        }

      let newCourseMember = new CourseMember(registration)

      await newCourseMember.save()

      res.redirect("/showCourse/"+res.locals.courseInfo._id)

    }
    catch(e){
      next(e)
    }
  }
)




app.get('/addProblemSet/:courseId',
  async ( req, res, next ) => {
      const id = req.params.courseId
      const courseInfo =
          await Course.findOne({_id:id},'name ownerId')
      res.render("addProblemSet",
                  {name:courseInfo.name,
                   ownerId:courseInfo.ownerId,
                   courseId:courseInfo._id})
    }
)


app.post('/saveProblemSet/:courseId',
  async ( req, res, next ) => {
    try {
      const id = req.params.courseId
      let newProblemSet = new ProblemSet(
         {
          name: req.body.name,
          courseId:id,
          createdAt: new Date()
         }
      )

      await newProblemSet.save()

      res.locals.courseInfo =
          await Course.findOne({_id:id},'name coursePin ownerId')

      res.locals.problemSets =
        await ProblemSet.find({courseId:res.locals.courseInfo._id})

      res.redirect("/showCourse/"+res.locals.courseInfo._id)

    }
    catch(e){
      next(e)
    }
  }
)

app.get('/showProblemSet/:psetId',
  async ( req, res, next ) => {
    const psetId = req.params.psetId
    res.locals.psetId = psetId
    res.locals.problemSet =
        await ProblemSet.findOne({_id:psetId})
    res.locals.problems =
        await Problem.find({psetId:psetId})
    res.locals.courseInfo =
        await Course.findOne({_id:res.locals.problemSet.courseId},
                              'ownerId')
    res.render('showProblemSet')
  }
)

app.get('/addProblem/:psetId',
      (req,res) => res.render("addProblem",{psetId:req.params.psetId})
    )


app.post('/saveProblem/:psetId',
  async ( req, res, next ) => {
    try{
        const psetId = req.params.psetId
        res.locals.psetId = psetId
        res.locals.problemSet = await ProblemSet.findOne({_id:psetId})
        let newProblem = new Problem(
           {
            courseId: res.locals.problemSet.courseId,
            psetId: res.locals.problemSet._id,
            description: req.body.description,
            problemText: req.body.problemText,
            points: req.body.points,
            rubric: req.body.rubric,
            pendingReviews: [],
            createdAt: new Date()
           }
          )

        await newProblem.save()
            .then( (p) => {
              res.locals.problem = p
            } )

        res.locals.problems = await Problem.find({psetId:psetId})
        res.locals.courseInfo =
            await Course.findOne({_id:res.locals.problemSet.courseId},
                                  'ownerId')
        res.render("showProblemSet")
      }
    catch(e){
      next(e)
    }
  }
)

app.post('/updateProblem/:probId',
  async ( req, res, next ) => {
    try {
      const problem =
          await Problem.findOne({_id:req.params.probId})

      problem.description= req.body.description
      problem.problemText= req.body.problemText
      problem.points= req.body.points
      problem.rubric= req.body.rubric
      problem.createdAt =  new Date()

      await problem.save()

      res.redirect("/showProblem/"+req.params.probId)
    }
    catch(e){
      next(e)
    }
  }
)


app.get('/showProblem/:probId',
      async (req, res, next) => {
        try {
          const probId = req.params.probId
          res.locals.probId = probId
          res.locals.problem = await Problem.findOne({_id:probId})
          res.locals.course =
              await Course.findOne({_id:res.locals.problem.courseId},
                                    'ownerId')
          res.locals.answerCount = await Answer.countDocuments({problemId:probId})
          const reviews = await Review.find({problemId:probId})
          res.locals.reviewCount = reviews.length
          res.locals.averageReview=
              reviews.reduce((t,x)=>t+x.points,0)/reviews.length
          res.locals.answers = await Answer.find({problemId:probId,studentId:res.locals.user._id})

          res.render("showProblem")
        } catch (e) {
              console.log("Error in showProblem: "+e)
              next(e)
        }
      }
)



app.get('/showAllAnswers/:probId',
    async (req, res, next ) => {
      try {
          const id = req.params.probId
          res.locals.problem = await Problem.findOne({_id:id})
          const course =
            await Course.findOne({_id:res.locals.problem.courseId})
          const userReviews =
            await Review.find({problemId:id,reviewerId:req.user._id})
          res.locals.numReviews = userReviews.length
          res.locals.canView =
              ((res.locals.numReviews>=5) ||
               (req.user._id.equals(course.ownerId)))
          if (!res.locals.canView){
              res.locals.answers=[]
              res.locals.reviews=[]
          }else {
            res.locals.answers = await Answer.find({problemId:id})
              .collation({locale:'en',strength: 2})
              .sort({answer:1})
            res.locals.reviews = await Review.find({problemId:id})
          }
          res.render('showAllAnswers')
      }
    catch(e){
      next(e)
    }
  }
)

app.get('/editProblem/:probId',
  async ( req, res, next ) => {
    const id = req.params.probId
    res.locals.probId = id
    res.locals.problem = await Problem.findOne({_id:id})
    res.locals.course =
        await Course.findOne({_id:res.locals.problem.courseId},'ownerId')
    res.render("editProblem")
  }
)

app.post('/saveAnswer/:probId',
  async ( req, res, next ) => {
    const id = req.params.probId
    res.locals.problem = await Problem.findOne({_id:id})
    const problem = res.locals.problem

    let newAnswer = new Answer(
         {
          studentId:req.user._id,
          courseId:problem.courseId,
          psetId:problem.psetId,
          problemId:problem._id,
          answer:req.body.answer,
          reviewers: [],
          numReviews: 0,
          pendingReviewers: [],
          createdAt: new Date()
         }
        )

    newAnswer.save()
      .then( (a) => {
          res.locals.answered = true
          res.locals.answer = a
      }
    )

    res.redirect("/showProblem/"+id)
  }
)


app.get('/reviewAnswers/:probId',
async (req,res,next) => {
  try{

    const probId = req.params.probId
    let problem = await Problem.findOne({_id:probId})

    //first we remove all pendingReviews that have exceeded
    // the time limit of 60 secs = 60,000 ms
    // 60 is a magic number and should be moved up somewhere...
    const tooOld = (new Date).getTime() - 60*1000;
    let expiredReviews = []
    let pendingReviews =
        problem.pendingReviews.filter((x)=>{

          if (x.timeSent<tooOld) {
            expiredReviews.push(x)
            console.log("\nremoved an expired review ")
            console.dir(x)

            return false
          } else {
            return true
          }
        })
    problem.pendingReviews = pendingReviews
    problem.markModified('pendingReviews')
    await problem.save()



    expiredReviews.forEach(async function(x){
      // remove the reviewerId from the list of pendingReviewers
      // and decrement the optimistic numReview field
      // pendingReviews has form x = {answerId,reviewerId,timeSent}
      let tempAnswer = await Answer.findOne({_id:x.answerId})
      tempAnswer.pendingReviewers =
          tempAnswer.pendingReviewers.filter((r)=>{
            if (r.equals(x.reviewerId)) {
              tempAnswer.numReviews -= 1
              console.log("\nremoved reviewer '+r+' from pending reviews: ")
              console.dir(x)
              return false
            } else {
              console.log('not removing '+r+' from pending reviewers')
              return true
            }
          }
        )
      tempAnswer.markModified('pendingReviewers')
      await tempAnswer.save()

    })


    // next, we find all answers to this Problem, sorted by numReviews
    let answers =
        await Answer.find({problemId:probId})
                    .sort({numReviews:'asc'})

    // find first answer not already reviewed or being reviewed by user
    let i=0
    let answer = null
    while (i<answers.length){
      answer = answers[i]
      if (!answer.reviewers.find((x)=>(x.equals(req.user._id)))
          &&
          !answer.pendingReviewers.find((x)=>(x.equals(req.user._id)))
        ){

          // we found an answer the user hasn't reviewed!
          answer.numReviews += 1 // we optimistically add 1 to numReviews
          answer.pendingReviewers.push(req.user._id)
          answer.markModified('pendingReviewers')
          await answer.save()

          // {answerId,reviewerId,timeSent}
          problem.pendingReviews.push(
            {answerId:answer._id,
             reviewerId:req.user._id,
             timeSent:(new Date()).getTime()})

          problem.markModified('pendingReviews')

          await problem.save()
          break
        }
      else {
        answer=null
      }
      i++
    }



    // and we need to add it to the problem.pendingReviews
    res.locals.answer = answer
    res.locals.problem = problem
    res.locals.numReviewsByMe =
        await Review.find({problemId:problem._id,
                           reviewerId:req.user._id}).length


    res.render("reviewAnswer")
  }
  catch(e){
    next(e)
  }
 }
)

  /*  saveReview
    when we save a review we need to create a new review document
    but also update the corresponding answer and problem documents
    to store the new information about number of reviews and pending reviews
    This is used when we generate an answer for a user to review
  */
app.post('/saveReview/:probId/:answerId',

  async ( req, res, next ) => {
    try {

      const problem =
          await Problem.findOne({_id:req.params.probId})

      const answer =
          await Answer.findOne({_id:req.params.answerId})

      const newReview = new Review(
       {
        reviewerId:req.user._id,
        courseId:problem.courseId,
        psetId:problem.psetId,
        problemId:problem._id,
        answerId:req.params.answerId,
        review:req.body.review,
        points:req.body.points,
        upvoters: [],
        downvoters: [],
        createdAt: new Date()
       }
      )

      await newReview.save()

      // next we update the reviewers info in the answer object
      answer.reviewers.push(req.user._id)
      answer.numReviews += 1

      let pendingReviewers = []

      for (let i=0; i<answer.pendingReviewers.length; i++){
        const reviewer = answer.pendingReviewers[i]

        if (reviewer.equals(req.user._id)){
          answer.numReviews -= 1

          // because we incremented it when we sent the review to user
        } else {
          pendingReviewers.push(reviewer)
        }
      }
      answer.pendingReviewers = pendingReviewers
      answer.markModified('pendingReviewers')

      await answer.save()

      // finally we update the pendingReviews field of the problem
      // to remove this reviewer on this answer, if necessary
      // the reviewInfo might have been removed earlier if they
      // timed out before completing their review...
      let pendingReviews=[]
      for (let i=0; i<problem.pendingReviews.length; i++){
        reviewInfo = problem.pendingReviews[i]

        if (reviewInfo.answerId.equals(answer._id) &&
            reviewInfo.reviewerId.equals(req.user._id)){
          // don't push answer just reviewed by this user back into pendingReviews
        } else {
          pendingReviews.push(reviewInfo)
        }
      }

      problem.pendingReviews = pendingReviews

      problem.markModified('pendingReviews')


      await problem.save()

      res.redirect('/showReviewsOfAnswer/'+answer._id)
      // we can now redirect them to review more answers
      // res.redirect('/reviewAnswers/'+req.params.probId)
    }
    catch(e){
      next(e)
    }
  }
)

app.get('/showReviewsOfAnswer/:answerId',
  async ( req, res, next ) => {
    try {
      const id = req.params.answerId
      res.locals.answer = await Answer.findOne({_id:id})
      res.locals.problem = await Problem.findOne({_id:res.locals.answer.problemId})
      res.locals.reviews =
          await Review.find({answerId:id})
                      .sort({points:'asc',review:'asc'})

      res.render("showReviewsOfAnswer")
      }
    catch(e){
        next(e)
      }
    }
)

app.get('/thumbsU/:mode/:reviewId/:userId',
  async (req,res,next) => {
    let reviewId = req.params.reviewId
    let userId = req.params.userId
    let mode = req.params.mode
    if (mode=='select'){
      await Review.findOneAndUpdate(
         {_id: reviewId},
         {$push:{upvoters:userId}})
    }else {
      await Review.findOneAndUpdate(
         {_id: reviewId},
         {$pull:{upvoters:userId}})
    }

  res.json({result:"OK"})
  })

app.get('/thumbsD/:mode/:reviewId/:userId',
  async (req,res,next) => {
    let reviewId = req.params.reviewId
    let userId = req.params.userId
    let mode = req.params.mode
    if (mode=='select'){
      await Review.findOneAndUpdate(
         {_id: reviewId},
         {$push:{downvoters: userId}})
    } else {
      await Review.findOneAndUpdate(
         {_id: reviewId},
         {$pull:{downvoters: userId}})
    }

  res.json({result:"OK"})
  })


app.get('/showReviewsByUser/:probId',
  async ( req, res, next ) => {
      const id = req.params.probId
      res.locals.problem = await Problem.findOne({_id:id})
      res.locals.usersReviews =
          await Review.find(
                            {reviewerId:req.user._id,
                             problemId:res.locals.problem._id}
                           )
       res.locals.allReviews =
           await Review.find(
                             {problemId:res.locals.problem._id}
                            )
      const answerIds = res.locals.usersReviews.map((r)=>r.answerId)
      res.locals.usersReviewedAnswers = await Answer.find(
         {_id:{$in:answerIds}}
        )

      res.render("showReviewsByUser")
    }
)

app.get('/showReview/:reviewId',
  (req,res) => res.send("Under Construction")
)


app.get('/showAllStudentInfo/:courseId',
  (req,res) => {
    res.redirect('/showTheStudentInfo/all/'+req.params.courseId)
  }
)

app.get('/showStudentInfo/:courseId',
  (req,res) => {
    res.redirect('/showTheStudentInfo/summary/'+req.params.courseId)
  }
)

app.get('/showTheStudentInfo/:option/:courseId',
  async ( req, res, next ) => {
    try {
        const id = req.params.courseId
        // get the courseInfo
        res.locals.courseInfo =
            await Course.findOne({_id:id},'name ownerId')

        const isTA =
            req.user.taFor &&
            req.user.taFor.includes(res.locals.courseInfo._id)
        const isOwner =
            req.user._id.equals(res.locals.courseInfo.ownerId)

        if (!(isOwner || isTA)) {
          console.log('isOwner = '+isOwner)
          console.log('isTA = '+isTA)
          res.send("only the course owner and TAs can see this page")
          return
        }

        // get the list of ids of students in the course
        const memberList =
            await CourseMember.find({courseId:res.locals.courseInfo._id})
        res.locals.students = memberList.map((x)=>x.studentId)

        res.locals.studentsInfo =
            await User.find({_id:{$in:res.locals.students}})

        const courseId = res.locals.courseInfo._id
        res.locals.answers =
            await Answer.find({courseId:courseId})

        res.locals.problems =
            await Problem.find({courseId:courseId})

        res.locals.reviews =
            await Review.find({courseId:courseId})

        const gradeSheet =
           createGradeSheet(
             res.locals.studentsInfo,
             res.locals.problems,
             res.locals.answers,
             res.locals.reviews)


        res.locals.gradeSheet = gradeSheet

        await Course.findOneAndUpdate(
                {_id:courseId},
                {$set:{gradeSheet:gradeSheet,gradesUpdateTime:new Date()}},
                {new:true})


        if (req.params.option == 'all'){
          res.render("showAllStudentInfo")
        } else {
          res.render("showStudentInfo")
        }
      }
    catch(e){
        next(e)
      }
    }
)



app.get('/showOneStudentInfo/:courseId/:studentId',
  async (req, res, next) => {
    try {
      res.locals.courseInfo =
          await Course.findOne({_id:req.params.courseId},'name ownerId gradeSheet')
      res.locals.studentInfo =
          await User.findOne({_id:req.params.studentId})

      const isTA =
          req.user.taFor &&
          req.user.taFor.includes(res.locals.courseInfo._id)
      const isOwner =
          req.user._id.equals(res.locals.courseInfo.ownerId)

      if (!isOwner && !isTA && !(req.user._id.equals(req.params.studentId))) {
        res.send("only the course owner and TAs and the student themselves can see this page")
        return
      }

      res.render("showOneStudentInfo")
    }
    catch(e){
      next(e)
    }
  }
)

app.post('/addTA/:courseId',
  async (req,res,next) => {
    try {
      console.log("in addTA handler "+req.body.email)
      let ta =
        await User.findOne({googleemail:req.body.email})
      if (ta){
        ta.taFor = ta.taFor || []
        ta.taFor.push(req.params.courseId)
        ta.markModified('taFor')
        console.log("updating ta "+ta._id)
        console.dir(ta)
        await ta.save()
      }
      res.redirect('/showTAs/'+req.params.courseId)
    }catch(e){
      next(e)
    }
  })

app.post('/removeTAs/:courseId',
async (req,res,next) => {
  try {
    console.log("in removeTAs handler ")
    console.dir(req.body)
    console.log(typeof req.body.ta)
    if (req.body.ta == null){
      console.log("nothing to delete")
    } else if (typeof req.body.ta == 'string') {
      console.log("delete "+req.body.ta)
      await User.update({_id:req.body.ta},{$set:{taFor:[]}})
    } else {
      console.log("delete several:")
      req.body.ta.forEach(async (x) => {
        console.log('x='+x)
        await User.update({_id:x},{$set:{taFor:[]}})
      })
    }


    res.redirect('/showTAs/'+req.params.courseId)
  }catch(e){
    next(e)
  }
})

app.get('/showTAs/:courseId',
  async (req,res,next) => {
    try{
      res.locals.courseInfo =
          await Course.findOne({_id:req.params.courseId},'name ownerId coursePin')
      res.locals.tas =
        await User.find({taFor:req.params.courseId})
      console.log("in showTAs handler")


      res.render('showTAs')
    } catch(e){
      next(e)
    }

  })

app.get('/resetNumReviews',
  async (req, res, next) => {
   if (req.user.googleemail != "tjhickey@brandeis.edu"){
    res.send('you are not allowed to do this!')
  }else {
    try {
      const answers =
          await Answer.find({})
      answers.forEach(async (x) => {
        const len = x.reviewers.length
        x.numReviews = len
        x.pendingReviewers = []
        x.markModified('pendingReviewers')
        await x.save()
      })
      const problems = await Problem.find({})
      problems.forEach(async (p) => {
        if (p.pendingReviews.length > 0){
          p.pendingReviews = []
          p.markModified('pendingReviews')
          await p.save()
        }
      })
    }catch(e){
      console.log("caught an error: "+e)
      console.dir(e)
    }
    res.redirect('/')
   }
  }
)


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


function createGradeSheet(students, problems, answers, reviews){
  let gradeSheet = {}
  let problemList = {}
  let answerList={}
  for (let s in students){
    let student = students[s]
    gradeSheet[student._id]={student:student,answers:{}}
  }
  for (let p in problems){
    let problem = problems[p]
    problemList[problem._id]=problem
  }
  for (let a in answers){
    let answer = answers[a]
    try {

      answerList[answer._id]= answer
      // it is possible that a TA will not be a student
      // so we need to create a
      gradeSheet[answer.studentId] =
          gradeSheet[answer.studentId] || {status:'non-student',student:'non-student',answers:{}}
      gradeSheet[answer.studentId]['answers'][answer._id]
        ={answer:answer, reviews:[]}
    } catch(e){
      console.log("Error in createGradeSheet: "+error.message+" "+error)
    }
  }

  for (let r in reviews) {
    let review = reviews[r]
    try {
      let z =
        gradeSheet[answerList[review.answerId].studentId]
          ['answers'][review.answerId]
      //z['reviews'] = z['reviews']||[]
      z['reviews'].push(review)
    } catch(e){
      console.log("Error in createGradeSheet-2s: "+error.message+" "+error)


    }
  }


  return {grades:gradeSheet,problems:problemList,answers:answerList}
}

module.exports = app;
