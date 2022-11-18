var [problems, courseInfo, myAnswers, psetReviews, skills] = data_loader();

var activeId = problem_list(problems, courseInfo, skills);

problem_content(problems);


// *************************    function defination    *************************
function data_loader() {
  // get data
  var d = document.getElementById("passLocal").dataset.problems;
  console.log(d.length);
  var problems = JSON.parse(document.getElementById("passLocal").dataset.problems);
  
  var courseInfo = JSON.parse(document.getElementById("passLocal").dataset.courseinfo);
  var myAnswers = JSON.parse(document.getElementById("passLocal").dataset.myanswers);
  console.log(document.getElementById("passLocal").dataset.myanswers);
  var psetReviews = JSON.parse(document.getElementById("passLocal").dataset.psetreviews);
  console.log(document.getElementById("passLocal").dataset.psetreviews);
  var skills = JSON.parse(document.getElementById("passLocal").dataset.skills);
  
  return [problems, courseInfo, myAnswers, psetReviews, skills];
}

function problem_list(problems, courseInfo, skills) {
  var ul = document.getElementById("problem_list");
  ul.setAttribute("class", "nav nav-tabs");
  
  var activeId = -1;
  
  for (var i = 0; i < problems.length; i++) {
    // li start
    var li = document.createElement("li");
    if (activeId==-1) {
      li.setAttribute("class", "active text-center");
      activeId = i;
    } else {
      li.setAttribute("class", "text-center");
    }
  
    // a start
    var a = document.createElement("a");
    a.setAttribute("href", "#Problem"+i.toString());
    a.setAttribute("data-toggle", "tab");
    
    // strong
    var strong = document.createElement("strong");

    var problem_title = problems[i].description || "no name"
    if (problem_title.length > 16) {
      problem_title = problem_title.substring(0, 16);
      problem_title += " ..."
    };
    strong.appendChild(document.createTextNode((i+1).toString()+". "+problem_title));

    const skillsToMaster=problems[i].skills.filter( (skill)=> !skills.includes(skill.toString())).length
    // div start
    var div = document.createElement("div");
    // small
    var small = document.createElement("small");
    if (skillsToMaster == 0) {
      div.setAttribute("style", "margin-top:5px; border-radius: 4px; border: white; color:green; \
        padding:1px 10px; background-color:rgb(218, 255, 223); ");
      small.appendChild(document.createTextNode("all skills mastered"));
    } else {
      div.setAttribute("style", "margin-top:5px; border-radius: 4px; border: white; color:red; \
        padding:1px 10px; background-color:rgb(255, 218, 218); ");
      small.appendChild(document.createTextNode(skillsToMaster.toString() + "/" 
      + problems[i].skills.length.toString() + " " + "skills left to master"));
    }
    
    // div end
    div.appendChild(small);

    // a end
    a.appendChild(strong);
    a.appendChild(div);
    
    // li end
    li.appendChild(a);
    
    // ul end
    ul.appendChild(li);
  }

  return activeId;
}

function problem_content(problems, courseInfo, myAnswers, psetReviews, skills) {
  // problem content start
  var problemContent = document.getElementById("problem_content");
  problemContent.setAttribute("id", "not-answer-yet");
  problemContent.setAttribute("class", "tab-content");
  problemContent.setAttribute("style", "background-color:rgb(255, 255, 255); margin-bottom:20px");
  for (var i = 0; i < problems.length; i++) {
    // problem start
    var prob = document.createElement("div");
    prob.setAttribute("id", "Problem"+i.toString());
    if (i==activeId) {
      prob.setAttribute("class", "tab-pane fade in active");
    } else {
      prob.setAttribute("class", "tab-pane fade");
    }
    prob.setAttribute("style", "margin-left:25px; margin-right:25px; font-family:'Courier New'")
    
    var question = question_from(i);
    var answer = answer_from(i, courseInfo, myAnswers, psetReviews, skills);

    prob.appendChild(question);
    prob.appendChild(document.createElement("br"));
    prob.appendChild(answer);

    // Question content end
    problemContent.appendChild(prob);
  }
}

function question_from(i) {
  // ---- Quetion from ----
  var question = document.createElement("div");
  // Quetion title
  var question_title = document.createElement("h3");
  question_title.setAttribute("style", "font-family:'Courier New'; font-weight: bold;");
  question_title.appendChild(document.createTextNode(problems[i].description));

  // Quetion description
  var question_description = document.createElement("h4");
  question_description.appendChild(document.createTextNode(problems[i].problemText));

  // question
  question.appendChild(question_title);
  question.appendChild(question_description);

  return question;
}

function answer_from(i, courseInfo, myAnswers, psetReviews, skills) {
  // ---- answer from ----
    // answer from start
    var answer = document.createElement("div");
    answer.setAttribute("class", "form-answer");
    answer.setAttribute("style", "margin-top:20px; margin-bottom:20px");

    // Your answer
    var answer_label = document.createElement("label");
    answer_label.setAttribute("for", "answer");
    answer_label.setAttribute("style", "color:rgb(35, 35, 35)");
    var answer_label_h4 = document.createElement("h4");
    answer_label_h4.appendChild(document.createTextNode("Your answer"));
    answer_label.appendChild(answer_label_h4);

    // text area
    var text_area = document.createElement("textarea");
    text_area.setAttribute("class", "form-control form-control-lg");
    text_area.setAttribute("style", "font-family:'Courier New'; font-size:12pt");
    text_area.setAttribute("rows", 10);
    text_area.setAttribute("placeholder", "Enter your answer here");
    
    // button
    var button = document.createElement("button");
    button.setAttribute("type", "button");
    button.setAttribute("class", "d-grid col-4 mx-auto");
    button.setAttribute("style", "font-size:12pt; margin-top:5px; margin-bottom:20px; \
      border-radius: 4px; border: white; color:white; background-color:rgb(66, 126, 255)");
    button.appendChild(document.createTextNode("Submit"));

    // answer from end
    answer.appendChild(answer_label);
    answer.appendChild(text_area);
    answer.appendChild(button);
    answer.appendChild(document.createElement("br"));
    answer.appendChild(document.createElement("br"));
    var skill = skill_from(i, courseInfo, myAnswers, psetReviews, skills);
    answer.appendChild(skill);

    return answer;
}

function skill_from(i, courseInfo, myAnswers, psetReviews, skills) {
  // skill from start
  var skill = document.createElement("div");
  skill.setAttribute("class", "card");
  skill.setAttribute("style", "margin-bottom:margin-bottom:20px; border:white; border-radius: 4px; \
    background-color:rgb(218, 249, 255); margin-left:-25px; margin-right:-25px;");
  
  // body start
  var skill_body = document.createElement("div");
  skill_body.setAttribute("class", "card-body");
  skill_body.setAttribute("style", "margin-left:20px")

  // title
  var skill_body_h4 = document.createElement("h4");
  skill_body_h4.setAttribute("class", "card-title");
  skill_body_h4.setAttribute("style", "margin-top:20px; font-weight: bold;");
  skill_body_h4.appendChild(document.createTextNode("2 Skills: "));

  // content
  var skill_body_p = document.createElement("p");
  skill_body_p.setAttribute("class", "card-text");
  
  var skill_body_p_li = document.createElement("li");
  skill_body_p_li.setAttribute("style", "color:red; font-weight: bold;");
  skill_body_p_li.appendChild(document.createTextNode("Created"));
  var skill_body_p_li_span = document.createElement("span");
  skill_body_p_li_span.appendChild(document.createTextNode("  - skills mastered"))
  skill_body_p_li.appendChild(skill_body_p_li_span)

  skill_body_p.appendChild(skill_body_p_li);
  
  
  // body end
  skill_body.appendChild(skill_body_h4);
  skill_body.appendChild(skill_body_p);

  // skill from end
  skill.appendChild(skill_body);

  return skill;
}