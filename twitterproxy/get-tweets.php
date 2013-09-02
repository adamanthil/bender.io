<?
// Use already made Twitter OAuth library
// https://github.com/mynetx/codebird-php
require_once ('codebird/src/codebird.php');
require_once ('credentials.php');

// Get authenticated
\Codebird\Codebird::setConsumerKey(CONSUMER_KEY, CONSUMER_SECRET);
$cb = \Codebird\Codebird::getInstance();
$cb->setToken(ACCESS_TOKEN, ACCESS_TOKEN_SECRET);

// Make the REST call
$params = array(
	'screen_name' => 'adamanthil',
	'count' => 5,
	'exclude_replies' => true
);

$data = (array) $cb->statuses_userTimeline($params);

$output = array();
$count = 0;
foreach($data as $tweet) {
	$output[] = array(
		'tweet' => $tweet->text,
		'time' => $tweet->created_at
	);
	$count++;

	// Twitter's API doesn't always return the full count
	// so make sure we only get 2 tweets
	if($count > 1) break;
}

// Output result in JSON, getting it ready for jQuery to process
echo json_encode($output);

?>
