/*
  auth.js handles all of the authentication routes
*/
const express = require("express");
const app = express.Router();

// Authentication
var GoogleStrategy = require("passport-google-oauth").OAuth2Strategy;
// here we set up authentication with passport
const passport = require("passport");
const configPassport = require("../config/passport");
configPassport(passport);

const User = require("../models/User");

// here are the authentication routes
app.use(passport.initialize());
app.use(passport.session());

// here is where we check on their logged in status
app.use((req, res, next) => {
  res.locals.title = "Peer Review App";
  res.locals.loggedIn = false;
  if (req.isAuthenticated()) {
    res.locals.user = req.user;
    res.locals.loggedIn = true;
  } else {
    res.locals.user = {};
    res.locals.loggedIn = false;
  }
  next();
});

app.get("/loginerror", function (req, res) {
  res.locals.routeName = " loginerror";
  res.render("loginerror", {});
});

app.get("/login", function (req, res) {
  res.locals.routeName = " login";
  res.locals.allow_local_login = process.env.ALLOW_LOCAL_LOGIN;
  console.log('in /login: allow_local_login = ' + res.locals.allow_local_login);
  res.render("login", {});
});

// route for logging out
app.get("/logout", function (req, res) {
  // req.session.destroy((error) => {
  //   console.log("Error in destroying session: " + error);
  // });
  // req.logout();
  // res.redirect("/");
  req.logout(function (err) {
    if (err) { return next(err); }
    res.redirect('/');
  });
});

// =====================================
// GOOGLE ROUTES =======================
// =====================================
// send to google to do the authentication
// profile gets us their basic information including their name
// email gets their emails
app.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

app.get(
  "/login/authorized",
  passport.authenticate("google", {
    successRedirect: "/lrec",
    failureRedirect: "/loginerror",
  })
);

app.get("/login/local", async (req, res, next) => {
  res.locals.routeName = " login";
  res.render("localLogin");
});

app.post("/auth/local/register", function (req, res, next) {
  console.log("registering user");
  User.register(new User({ googleemail: req.body.username, googlename: req.body.name }), req.body.password, function (err) {
    if (err) {
      console.log("error while user register!", err);
      // try {
      //   User.changePassword(undefined, req.body.password);
      //   User.save()
      // } catch (e) {
      // next(e);
      // }
      return next(err);
    }

    console.log("user registered!");

    res.redirect("/login/local");
  });
});

app.post("/auth/local/login", passport.authenticate("local", { failureRedirect: "/loginerror" }), function (req, res) {
  res.redirect("/lrec");
});

module.exports = app;
