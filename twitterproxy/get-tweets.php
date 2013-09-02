<?
// Use already made Twitter OAuth library
// https://github.com/mynetx/codebird-php
require_once ('codebird/src/codebird.php');
require_once ('credentials.php');

//Get authenticated
\Codebird\Codebird::setConsumerKey(CONSUMER_KEY, CONSUMER_SECRET);
$cb = \Codebird\Codebird::getInstance();
$cb->setToken(ACCESS_TOKEN, ACCESS_TOKEN_SECRET);

//Make the REST call
$data = (array) $cb->statuses_homeTimeline();

//Output result in JSON, getting it ready for jQuery to process
echo json_encode($data);

?>
