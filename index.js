/*
English Dictionary Lookup                      
An add-on for the Google Chrome browser allowing for easy lookup (using GCIDE_XML) and display of English word definitions within webpages via a double-click and an unobtrusive dialog box.
Written in 2016 by Cole Anderson (ande4163@umn.edu)
*/
//file locations of all helper files
var abbrURL = "lib/gcide/xml_files/gcide_abbreviations.csv";
var abbrRegExURL = "lib/gcide/abbr_regex.txt"; 
var symbolURL = "lib/gcide/xml_files/gcide_symbols.csv";
var symbolRegExURL = "lib/gcide/symbols_regex.txt";

var abbrText;  //entire abbreviation csv file
var abbrRegEx;  //abbreviation key list for regex
var symbolText;  //entire unicode symbol csv file
var symbolRegEx;  //symbol key list for regex

var etyAbbrRegEx = "L|E|Heb|Dan|Rom"; //etymology abbreviation key list for regex
var etyAbbrText = "L,Latin\nE,English\nHeb,Hebrew\nDan,Danish\nRom,Roman"; //etymology abbreviation csv string 

var posNumber; //numbering for pos elements and pos linking

var globalWord; //current word
var prevWord; //previous word
var wordHistory = new Array(); //word history tracking for pseudo-back-button display

var iframe;

//create iframe definition box
function createIframe(defHtml)
{ 
  //don't add a frame within a frame
  var extensionOrigin = 'chrome-extension://' + chrome.runtime.id;
  if (!location.ancestorOrigins.contains(extensionOrigin)) {
   
    var iframeExists = false;    

    //check if iframe exists
    if (iframe)
      if (iframe.parentNode)
        iframeExists = true;
    
    //only create iframe if it doesn't exist
    if (!iframeExists)
    {        
    iframe = document.createElement('iframe');

    iframe.setAttribute("id", "dictlookupiframe");
    iframe.setAttribute("style",'position:fixed;top:50%;left:50%;margin-top: -100px;margin-left: -200px;display:block;width:400px;height:200px;z-index:1000;background:lightgrey;color:black;border:1px solid grey;padding: 4px 4px 0px 0px');
 
    document.body.appendChild(iframe);
    }

    //insert definition html in iframe
    defHtml = "<body style=\"font-family:sans-serif;font-size:14px;\">" + defHtml + "</body>";
    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(defHtml);
    //add event listener inside of iframe for word lookups inside of definitions 
    iframe.contentWindow.document.addEventListener('dblclick',function(){lookupSelection(iframe.contentWindow)}); 
    iframe.contentWindow.scrollTo(0,0);
    iframe.contentWindow.document.close();

    //add event to delete iframe upon main window click
    document.addEventListener('click',deleteIframe);
  }  
}

//delete iframe definition box
function deleteIframe()
{
  if (iframe)
    if (iframe.parentNode)
      iframe.parentNode.removeChild(iframe); //if iframe exists, remove it
  document.removeEventListener('click',deleteIframe); //remove event listener for main window click
}

//declare request object for local dictionary files 
var xhr = new XMLHttpRequest();

//when the request has been fulfilled, parse response 
xhr.onload = function() {

  if (abbrText && abbrRegEx && symbolText && symbolRegEx)
  {
    console.log("def_respurl: " + xhr.responseURL.toString());
    var definition = parseDefResponse(xhr.response); //parse and format definition response
    if (definition)
      createIframe(definition); //send definition to iframe
  }
  else if (xhr.responseURL.toString().match(abbrURL))
  {
    console.log("abbrtext_respurl: " + xhr.responseURL.toString());
    abbrText = xhr.response;
    getURL(abbrRegExURL);
  }
  else if (xhr.responseURL.toString().match(abbrRegExURL))
  {
    console.log("abbrregex_respurl: " + xhr.responseURL.toString());
    abbrRegEx = xhr.response;
    getURL(symbolURL);
  }
  else if (xhr.responseURL.toString().match(symbolURL))
  {
    console.log("symboltext_respurl: " + xhr.responseURL.toString());
    symbolText = xhr.response;
    getURL(symbolRegExURL);
  }
  else if (xhr.responseURL.toString().match(symbolRegExURL))
  {
    console.log("symbolregex_respurl: " + xhr.responseURL.toString());
    symbolRegEx = xhr.response;
  }
  else
  {
    console.log("def_error_respurl: Definition response occured without addon initialization, this should never happen");
  }
}
xhr.onerror = function() {
  dump("Error while getting XML.");
}

//fetch a requested file
function getURL(reqURL) {
  xhr.open("GET", chrome.extension.getURL(reqURL));
  xhr.responseType = "text";
  xhr.send();
}

// find and return abbreviation match including pseudo-regex-lookbehind character
function getAbbrFull(match, p1, p2, offset, string) {

  //search for p2 in abbreviation csv file
  var abbrReg = new RegExp("^" + p2.toString() + "[.],(.*)", "m");
  var abbr = abbrReg.exec(abbrText);

  if (p1)
  {
    if (abbr[1])
      return p1 + abbr[1];
    else
      return p1;
  }
  else
    return "";
}

// find and return symbol match
function getSymbol(match, p1, offset, string) {

  //search for p1 in abbreviation csv file
  var symbolReg = new RegExp("^" + p1.toString() + ",(.*)", "m");
  var symbol = symbolReg.exec(symbolText);

  if (symbol[1])
    return symbol[1];
  else
    return "";
}

// find each abbreviation match in etymology element and replace abbreviation with full word
function getEtyAbbr(match, offset, string) {

  return match.replace(new RegExp('([^a-zA-Z#\".;])(' + etyAbbrRegEx + ')[.]',"g"), getEtySymbol);
}

// find and return etymology abbreviation match including pseudo-regex-lookbehind character
function getEtySymbol(match, p1, p2, offset, string) {

  //search for p2 in etymology abbreviation csv string 
  var etyReg = new RegExp("^" + p2.toString() + ",(.*)", "m");
  var etySymbol = etyReg.exec(etyAbbrText);
  if (p1)
  {
    if (etySymbol[1])
      return p1 + etySymbol[1];
    else
      return p1;
  }
  else
    return "";
}

//return new pos element with new id attribute
function getPosHtml(match, p1, offset, string) {

  var newPosElement;
  var newP1;

  //remove spaces and add an incrementing number to pos id html attribute
  newP1 = p1.replace(new RegExp(" ", "g"), "") + ++posNumber;

  // pron. has multiple full word meaning, but only represents 'pronoun' in pos element 
  if (p1 == "pron.")
    p1 = "pronoun";

  newPosElement = '<pos id=\"' + newP1 + '\">' + p1 + "<\/pos>";

  return newPosElement;

}

//return pron element with bold and/or underline formating and replace pronunciation marks with more visually appealing characters
function getPron(match, p1, p2, p3, p4, offset, string) {

  p3 = p3.replace(new RegExp("[*]", "g"), "·");
  p3 = p3.replace(new RegExp('["]', "g"), "\'");
 
  if (p1 == "hw")
  {
    if (p2)
      return "<B>" + p3 + "<\/B>";
    else
      return "<B><U>" + p3 + "<\/U><\/B>";
  }
  else
    return "<" + p1 + ">" + p3 + "<\/" + p1 + ">";
  
}

//find word definition regex for searching within definition file
function getWordFindRegEx(word) {

  return new RegExp("<p><ent>(" + word + ")<\/ent>[^]+?<p><ent>(?!" + word + "<\/ent>)", "im");

}

//find the root part of a word by searching definition file for different combinations of word suffix
function findWordRoot(word,wordResponse) {

  var newWord;
  console.log("trying to find word root for: " + word);
  newWord = word.replace(new RegExp("^(.*?)(sses)$", "g"), "$1ss");

  var reContainsV = new RegExp('([aeiou]|.y)');
  var wordSplit;  

  if (newWord == word)
  {
    newWord = word.replace(new RegExp("(ies|ied|iness|iless|iment|ier|iest|iful|ily)$", "g"), "y");
    if (newWord == word)
      newWord = word.replace(new RegExp("(ise|ize|fy|ly|ful|able|ible|hood|ness|less|ess|ism|ment|ist|al|ish|tion|logy|ology|s|ed|ing|t|er|est)$", "g"), "");
  }
  
  if (wordResponse.match(getWordFindRegEx(newWord)) == null)
  {
    if (newWord[newWord.length-1] == 'e')
      newWord = newWord.replace(new RegExp("e$"), "");
    else
      newWord += "e";
    if (wordResponse.match(getWordFindRegEx(newWord)))
      return newWord;
    else
      return null;
  }

  console.log("found word root: " + newWord);

  return newWord;

}

//format definition string
function formatDefinition(wordfull) {

  var posN = 0;
  var posRegEx = new RegExp("<pos>(.*?)<\/pos>", "g");
  var posArray;
  var posHTML = "";
  var posId;

  posNumber = 0;

  wordfull = wordfull.replace(new RegExp("<ent>.*?<\/ent><p?(br)?\/>", "g"), ""); //remove ent (entry) element
  wordfull = wordfull.replace(new RegExp("<!--.*?-->", "g"), ""); //remove comments
  wordfull = wordfull.replace(new RegExp('<(hw)(f)?>(.*?)<\/hw(f)?>',"g"),getPron); //format hw (head word) element with bold and/or underlined characters
  wordfull = wordfull.replace(new RegExp('<(pr|wf)(>)(.*?)<\/(pr|wf)>',"g"),getPron); //format pr and wf elements with bold and/or underlined characters
  wordfull = wordfull.replace(new RegExp("<p?br\/>","g"),"<BR\/>"); //replace pbr and br (page break and break) elements with functional line breaks
  //create html for mid-page anchor linking to pos (part of speech?) elements (used for easily navigating to other word meanings)
  while((posArray = posRegEx.exec(wordfull)) != null)
  {
    posN++;
    posId = posArray[1].replace(new RegExp(" ", "g"), "");
    posHTML += '<a href=\"#' + posId + posN + '\">' + posId + '<sup>' + posN + '<\/sup>' + '<\/a>    ';
  }
  wordfull = wordfull.replace(posRegEx,getPosHtml); //add id attributes to pos elements for mid-page anchor linking 
  wordfull = wordfull.replace(new RegExp('<p><q>', "g"), '<p style=\"text-align: center\"><q>'); //format q (quote) elements so they are centered
  wordfull = wordfull.replace(new RegExp("<(\/)?(col|qex|qau|source|xex|pos|fld|ets|etsep|au|src|altname|altnpluf|mark|ex|asp|cref|sd|contr|ant|spn|ord|gen|pluf|uex|stype|mathex|ratio|singf|xlati|iref|figref|ptcl|part|var|tr)","g"),"<$1I"); //italicise certain tag content for proper emphasis 
  wordfull = wordfull.replace(new RegExp("<(\/)?er>","g"),"<$1B>"); //embolden er element
  wordfull = wordfull.replace(new RegExp("&(" + symbolRegEx + ");", "g"),getSymbol); //replace html entities with unicode
  wordfull = wordfull.replace(new RegExp(" <pr>[(][^)]*?([?]|&#xFFFD;)(.*?)[)]<\/pr>", "g"), "<pr><\/pr>"); //delete unknown and unfound symbols in pr (pronunciation) elements
  wordfull = wordfull.replace(new RegExp('([^a-zA-Z#\".;])(' + abbrRegEx + ')[.](?![0-9])',"g"),getAbbrFull); //replace abbreviations with full words using pseudo-regex-lookbehind
  wordfull = wordfull.replace(new RegExp("<ety>.*?[^a-zA-Z](" + etyAbbrRegEx + ")[.].*?<\/ety>","g"),getEtyAbbr); //replace etymology abbreviations with full words using pseudo-regex-lookbehind
  wordfull = wordfull.replace(new RegExp("<syn>"),'<syn id=\"synonyms\">'); //add synonym id attribute anchor for mid-page linking
  wordfull = "<BR\/>" + wordfull; //add line break at beginning of definition for link bar and pseudo-back-button
  //if there is word history then add pseudo-back-button
  if (wordHistory.length > 0)
    wordfull = '<back style=\"white-space: nowrap\"> [ &#x21FD; ' + wordHistory[wordHistory.length-1] + ' ]<\/back>    ' + wordfull; 
  //add pos mid-page links (for linking to other word meanings)
  wordfull = "[ " + posHTML + " ]    " + wordfull;
  //add synonym links
  if (wordfull.match("<syn"))
    wordfull = '<a href=\"#synonyms\">synonyms<\/a>    ' + wordfull;
  //add titular word to top of page
  wordfull = "<U>" + globalWord + "<\/U><dash> - <\/dash>    " + wordfull;

  wordfull = "<html>" + wordfull + "<\/html>";

  return wordfull;
}

//parse definition file for word definition and send it to panel
function parseDefResponse(response) {

  //find word in definition string
  var wordDef = getWordFindRegEx(globalWord).exec(response);

  //if word isn't found, try to find word root
  if (!wordDef)
    if (globalWord = findWordRoot(globalWord,response))
      wordDef = getWordFindRegEx(globalWord).exec(response);
    else
    {
      console.log("word [" + globalWord + "] not found");
      return null;
    }

  globalWord = wordDef[1].toString(); //get new word from regex result

  if (prevWord == globalWord) //if the previous word is the same as the new word then stop
  {
    text_entry.show()  
    return null;
  }

  //manage word history
  if (wordHistory.length > 0)
  {
    if (wordHistory[wordHistory.length-1] == globalWord)
      wordHistory.pop();
    else if (prevWord)
      wordHistory.push(prevWord);
  }
  else if (prevWord)
    wordHistory.push(prevWord);
 
  prevWord = globalWord;
  wordDef = wordDef[0] + "<\/ent><\/p>"; //add string to word definition to produce valid xml
  wordDef = formatDefinition(wordDef);  //format definition string

  return wordDef;

}

//lookup selection made in window specified
function lookupSelection(lookupWindow) {
  var word = lookupWindow.getSelection().toString();
  if (word)
  {
    console.log("A selection has been made.");
    if (abbrText && abbrRegEx && symbolText && symbolRegEx) //check if all files have been loaded
    { 
      word = word.replace(new RegExp("^\\s*(.*?)\\s*$"),"$1"); //remove leading and trailing whitespace from word
      if (!word.includes(' ') && (word.length > 0)) //check to make sure word doesn't include any spaces and has nonzero length
      { 
        var lowerletter = word.toLowerCase()[0];
        globalWord = word;
        console.log("Getting letter file [" + lowerletter + "] for: " + word);
        xhr.open("GET", chrome.extension.getURL("lib/gcide/xml_files/gcide_" +lowerletter + ".xml"));  //send url request for definition letter file
        xhr.responseType = "text";
        xhr.send();
      }
      else
        console.log("error: selection includes multiple words - [" + word + "]");
    }
    else
      console.log("selection made while loading. Please wait a few seconds and try again.");
  }
} 

//start getting helper files
if (!abbrText)
  getURL(abbrURL);

//add event listener for double-click to lookup current selection
document.addEventListener('dblclick',function(){lookupSelection(window)});
