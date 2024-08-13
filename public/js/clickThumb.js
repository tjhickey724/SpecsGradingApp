console.log("Loading function clickThumb")
    // code to handle clicking on the ThumbsUp/Down for a review
function clickThumb(courseId,i,reviewId,userId,direction){
  //console.log(`in clickThumb `);//with i=${i}, courseId=${courseId}, reviewId=${reviewId}, userId=${userId}, direction=${direction}`);
  const urlPath=courseId+"/"+reviewId+"/"+userId
  const reviewU = document.getElementById("reviewU"+i)
  const reviewD = document.getElementById("reviewD"+i)
  const review = document.getElementById("review"+direction+i)
  const likeSpan = document.getElementById("likes"+i)
  let numLikes = parseInt(likeSpan.innerHTML)
  const c = review.getAttribute("class")
  const cU = reviewU.getAttribute("class")
  const cD = reviewD.getAttribute("class")
  const isU = reviewU.getAttribute("class").startsWith('fas')
  const isD = reviewD.getAttribute("class").startsWith('fas')
  const otherDirection = (direction=='U')?'D':'U'
  let mode = ""
  if (!isU && !isD){
    if (direction=='U'){
      mode='up/select'
    } else {
      mode = 'down/select'
    }
  }else if (isU){
    mode = 'up/deselect'
  }else {
    mode='down/deselect'
  }
  switch (mode){
    case 'up/select':
      console.log("in up/select")
      reviewU.setAttribute("class","fas"+cU.substring(3))
      likeSpan.innerHTML = numLikes+1
      fetch('/thumbsU'+'/select/'+urlPath)
        .then(function(response) {
            response.text()
               .then(function(text) {
                   // don't need the response yet
               });
        });
      break
    case 'down/select':
      console.log("in down/select")
      reviewD.setAttribute("class","fas"+cD.substring(3))
      likeSpan.innerHTML = numLikes-1
      fetch('/thumbsD'+'/select/'+urlPath)
        .then(function(response) {});
      break
    case 'up/deselect':
      console.log("in up/deselect")
      reviewU.setAttribute("class","far"+cU.substring(3))
      likeSpan.innerHTML = numLikes-1
      fetch('/thumbsU'+'/deselect/'+urlPath)
        .then(function(response) {});
      break
    case 'down/deselect':
      console.log("in down/deselect")
      reviewD.setAttribute("class","far"+cD.substring(3))
      likeSpan.innerHTML = numLikes+1
      fetch('/thumbsD'+'/deselect/'+urlPath)
        .then(function(response) {});
      break
  }

}
