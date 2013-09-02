<?
// Use already made Twitter OAuth library
// https://github.com/mynetx/codebird-php
require_once ('codebird/src/codebird.php');
require_once ('credentials.php');

// Returns the realtive time as a string given a unix timestamp
function relativeTime($ts) {
	if(!ctype_digit($ts))
		$ts = strtotime($ts);

	$diff = time() - $ts;
	if($diff == 0)
		return 'now';
	elseif($diff > 0)
	{
		$day_diff = floor($diff / 86400);
		if($day_diff == 0)
		{
			if($diff < 60) return 'just now';
			if($diff < 120) return '1 minute ago';
			if($diff < 3600) return floor($diff / 60) . ' minutes ago';
			if($diff < 7200) return '1 hour ago';
			if($diff < 86400) return floor($diff / 3600) . ' hours ago';
		}
		if($day_diff == 1) return 'Yesterday';
		if($day_diff < 7) return $day_diff . ' days ago';
		if($day_diff < 31) return ceil($day_diff / 7) . ' weeks ago';
		if($day_diff < 60) return 'last month';
		return date('F Y', $ts);
	}
	else
	{
		$diff = abs($diff);
		$day_diff = floor($diff / 86400);
		if($day_diff == 0)
		{
			if($diff < 120) return 'in a minute';
			if($diff < 3600) return 'in ' . floor($diff / 60) . ' minutes';
			if($diff < 7200) return 'in an hour';
			if($diff < 86400) return 'in ' . floor($diff / 3600) . ' hours';
		}
		if($day_diff == 1) return 'Tomorrow';
		if($day_diff < 4) return date('l', $ts);
		if($day_diff < 7 + (7 - date('w'))) return 'next week';
		if(ceil($day_diff / 7) < 4) return 'in ' . ceil($day_diff / 7) . ' weeks';
		if(date('n', $ts) == date('n') + 1) return 'next month';
		return date('F Y', $ts);
	}
}

// Get authenticated
\Codebird\Codebird::setConsumerKey(CONSUMER_KEY, CONSUMER_SECRET);
$cb = \Codebird\Codebird::getInstance();
$cb->setToken(ACCESS_TOKEN, ACCESS_TOKEN_SECRET);

// Make the REST call
$params = array(
	'screen_name' => 'adamanthil',
	'count' => 20,
	'exclude_replies' => true
);

$data = (array) $cb->statuses_userTimeline($params);

$output = array();
$count = 0;
foreach($data as $tweet) {
	if(is_object($tweet)) {
		$time = new \DateTime($tweet->created_at);
		$output[] = array(
			'tweet' => $tweet->text,
			'time' => relativeTime($time->format('U'))
		);
		$count++;
	}

	// Twitter's API doesn't always return the full count
	// so make sure we only get 2 tweets
	if($count > 1) break;
}

// Output result in JSON, getting it ready for jQuery to process
echo json_encode($output);

?>
