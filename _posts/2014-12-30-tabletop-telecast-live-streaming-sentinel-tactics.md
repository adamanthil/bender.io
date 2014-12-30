---
layout: post
title: "Tabletop Telecast: Live Streaming Sentinel Tactics"
---
This past fall I was brought in to produce live video coverage of a competitive board game tournament by [Greater Than Games](http://greaterthangames.com/) in St. Louis, MO. The goal was to create a quality viewing experience comparable to high level eSports tournaments (think StarCraft II, League of Legends, and Hearthstone) except with a tabletop game on a fraction of the budget. It's been a particularly interesting project because of the assortment of disciplines involved. Everything from computer programming and audio mixing to photography and stage lighting were involved in one way or another. We definitely didn't quite approach the million dollar production values of [The International](http://en.wikipedia.org/wiki/The_International_%28video_gaming%29) or Blizzard's [WCS](http://wiki.teamliquid.net/starcraft2/2014_StarCraft_II_World_Championship_Series), but I believe we were able to create an enjoyable and compelling viewing experience that will continue to improve over time.

![Sentinel Tactics Game Board](/images/posts/tactics-board-setup.jpg)

[Sentinel Tactics](http://boardgamegeek.com/boardgame/146408/sentinel-tactics-flame-freedom) is a hex grid tactical combat miniatures game. Players control characters from the "Sentinel Comics" superhero universe and duke it out through various scenarios and skirmishes. Dice rolls are used to determine attack resolution and other aspects of the game. In the tournament setting, three person teams face off in skirmish play, drafting characters before the match similar to competitive [MOBAs](http://en.wikipedia.org/wiki/Multiplayer_online_battle_arena). The first team to score three incapacitations, or knockouts, wins the match.

eSports broadcasts benefit largely from the extensive design work of the game developers themselves to present relevant information to the viewer. Video games are intended to be viewed on a screen by the player, so translating that experience into a digital broadcast is fairly straightforward. Board games, on the other hand, are optimized for play in the physical world and exposing all the relevant game state information on a single, digital screen takes careful planning and additional design work. While we always intended the matches to be accompanied by high level audio commentary, we wanted viewers to easily understand what was going on during a game without leaning heavily on information from the casters. This led us to a strategy involving a set of stationary cameras along with roaming cameras and visual overlays. These goals demanded at least five angles to consistently capture everything we needed from the game board as well as the announcers (1 overhead camera for the full map, 1 overhead camera for a dice closeup, 2 roaming cameras, and 1 camera for the casters). The physical game utilizes cards, panels, and tokens to track information for each character, all of which are not as easily parsable in a video format. Hence, a set of custom graphical overlays were developed to present the score, current turn, character health, and other key information on screen.

![Broadcast Setup](/images/posts/tactics-table-setup.jpg)

#### Hardware Setup

Fortunately for this project, creating high quality digital video has continued to become more affordable in the past decade. What once cost tens of thousands of dollars can now be produced at an order of magnitude lower cost with largely consumer equipment. For Tactics, we used a combination of consumer, prosumer, and professional hardware to get the job done. An [ATEM 1 M/E Production Studio 4K](https://www.blackmagicdesign.com/products/atem) provided the video backbone and mixing capabilities, and a [Decklink 4k Extreme](https://www.blackmagicdesign.com/products/decklink) capture card allowed us to ingest the video into our computer on the fly and simultaneously send overlay information back to the mixer. All aspects of the video mix were controlled directly from the computer through custom macros and an [X-Keys](http://xkeys.com/xkeys/xk60.php) USB control board. We used a combination of Canon XHA1 and Panasonic HC-V750 cameras with component video/HDMI to SDI converters to get everything into HD-SDI format for the video mixer. Principle lighting and all stationary cameras were mounted to a 10-foot truss above the players and game board.

![Booth Setup](/images/posts/tactics-booth.jpg)

On the audio end, a Yamaha MGP24X mixer allowed us to manage three completely independent mixes for running the production. Of course, there was the live mix for the stream and recording, but behind the scenes the casters had a modified mix that allowed the production booth to communicate with them directly through their headphones. Additionally, the roaming camera operators had a separate mix and were continually being fed information and instructions from the booth. A pair of Shure VP82 shotgun mics hanging from the lighting truss provided game audio from the table to compliment the announcer's commentary.

#### Software and Overlays

In many ways, the most complex aspect of the broadcast was the set of custom overlays and templates that we needed to update in real time as the game progressed. In searching for methods to enable this interactivity, we came across an open source software package called [CasparCG](http://www.casparcg.com/) which has been developed by a broadcasting company in Sweden. CasparCG is designed for outputting visual templates for use in broadcast applications, and was able to function seamlessly with our Decklink capture card. In essence, Caspar creates an independent video feed of the overlay with alpha transparency, which is then sent from the computer to the video mixer and can be used just like any other video source.

The CasparCG rendering engine is built to utilize Adobe Flash for custom templates. However, the most common use case employs basic templates designed in Flash Professional with simple text that can be changed manually in the CasparCG interface during a broadcast. Given the complexity of the information and visuals we needed to display and update for Sentinel Tactics, this basic functionality was completely unusable for us. We would be simply unable to manually update teams, scores, health, and other data through text inputs while simultaneously mixing the video and audio and managing the stream. What's more, such restrictions place severe limitations on the design of the overlays and the way information must be displayed. Fortunately, since CasparCG contains a fully functional Flash engine, we were able to build completely custom templates using ActionScript. Anything Flash could display, we were able to create, animate, and modify on the fly programmatically. This opened up tremendous potential for the visuals and really allowed us to capture much of our vision.

However, this solution still left the issue of getting data to the ActionScript templates and updating it on demand. For this, we built a [node.js](http://nodejs.org/) web service and web application on top of the [hapi framework](http://hapijs.com/) to track live game state and statistics. On initial load, the ActionScript templates issued an HTTP request for the current game state and rendered themselves accordingly. Subsequent updates were pushed to any running templates through web sockets via the [Pusher](https://pusher.com/) messaging service. On the interface end, we built an ipad-optimized web application in [Clojurescript/Om](https://github.com/swannodette/om) to handle all state input. This enabled the person tracking game state to be right at the table with the players so they would have the most immediate access to any information they needed. It also freed the production staff from micromanaging game state, so the booth could focus on shot selection, mixing, and the overall production. Any time the broadcast required a particular visual template, we could bring it up and the information would be accurate. While there were a couple minor hiccups in our initial outing with this technology, overall it worked very well. You can see it in action [here](https://www.youtube.com/watch?v=3qRoIDs3p6s&t=33m32s) on the YouTube clips from our first broadcast.

{% imgpopup /images/posts/tactics-screencap-01.jpg /images/posts/tactics-screencap-01-full.jpg Sentinel Tactics Game In Progress %}

#### Real-Time Video Compositing with Javascript in a Web Browser

While our CasparCG/ActionScript templating system worked well for the majority of cases, one of the design ideas in our original concept couldn't be realized with that technology stack. We wanted to highlight the painted miniatures when the players were choosing their characters during the draft. We were inspired by the loading and matchmaking screens of games like [Heroes of the Storm](http://us.battle.net/heroes/en/), where all characters entering a match would be lined up in formation. Our idea was to have rotating versions of the miniatures appear as each player chose their character for the upcoming match. Since there are currently 15 playable characters, doing so in a way that would cover all possible team configurations required compositing keyed videos of each miniature into their arrangement on the fly to make up the final shot. For the videos themselves, we used a turntable, lightbox, and DSLR to record an individual clip for each mini on a white background. However, the composite was a particular challenge because virtually no video delivery formats support an alpha channel, and none do that are currently supported by Flash.

{% imgpopup /images/posts/tactics-drafting-screen.jpg /images/posts/tactics-drafting-screen-full.jpg Sentinel Tactics Drafting Screen %}

HTML5 video came to the rescue with the VP8 codec. VP8 supports an alpha channel, and Chrome is able to display it. We created a static web page that used Javascript to pull in the current draft and handle any web socket updates as characters were chosen. Chrome was able to run all six rotating videos together in a composite that was managed in real time via Javascript. In fact, all 15 videos were loaded initially and looped concurrently. Any not in use were simply positioned off screen to be moved into place on the fly as characters were chosen or changed. This web page was run as a secondary monitor on our streaming computer, the output of which was sent directly to the ATEM video mixer as a source. The only major issue we encountered was an auto-update to Chrome on the day of the broadcast which severely degraded the smoothness of video playback. This caused our cleverly-engineered drafting screen to be extremely choppy and unusable early on. We ended up manually forcing Chrome to revert to an earlier version between matches, which provided a temporary fix to the issue. You can see a sample of this page in action [here](https://www.youtube.com/watch?v=kwzk-aVfH-E).


#### Conclusions

Overall our inaugural broadcast went very well and was received with great enthusiasm by the fans. As with any live production there were a few hiccups, but for the first time producing anything of this complexity everyone was quite pleased. You can watch any of the matches over on YouTube if you like. Some of them were pretty exciting!

[YouTube: Sentinel Tactics Inaugural Tournament 2014](https://www.youtube.com/playlist?list=PLBZBled0v3sKbA-Ge7ic9cSwl6Q5DvB60)

There are some additions we would like to make in the near term including a second dice camera (we ended up having two dice boxes due to the size of the table), and some audio fixes and improvements to the mixing. We also have ideas for enhancements and additions to the overlays. Our initial concept for all the templates included much more than we were able to build for the first outing. Given the opportunity to continue producing tournaments for Sentinel Tactics, these enhancements should come in time. Some interesting updates on that front are already in the pipeline, so stay tuned for more information, and keep an eye on the Greater Than Games [Twitch Channel!](http://twitch.tv/greaterthangames)

![Setup](/images/posts/tactics-table-setup-01.jpg)