---
layout: post
title: Building an Expert Sheepshead AI with Reinforcement Learning
unlisted: true
toc: true
---
Since long before the current AI craze I've been fascinated by reinforcement learning, the practice of constructing systems by which computers can teach themselves complex behaviors through trial and error without direct guidance. These techniques have been key to most of the headline-grabbing AI results in game playing in recent years including computers beating the best humans at Go, Dota 2, Starcraft, etc. They also happen to be an integral part of the LLM post-training process. Conceptually, by giving the computer agent rewards for desirable actions (and negative rewards for undesirable actions) it learns complex strategy for itself, without the human operator even having to know _how_ to teach it. It's the kind of emergent behavior that feels almost magical.

I thought it would be a fun experiment to use reinforcement learning to teach a neural network how to play [Sheepshead](https://www.sheepsheadrules.com), a complex and subtle trick-taking card game popular in Wisconsin but virtually unknown elsewhere. I've been captivated by Sheepshead ever since learning and playing it at my high school lunch table and have always wished more people knew about it. For me, its complexity and dynamic nature keep it compelling hand after hand when compared to most other card games.

> Sheepshead is a 5 handed trick-taking game played using a standard deck with all cards below 7s removed, leaving a deck of 32 cards.
>
> - **Trump:** all Queens, Jacks, and Diamonds.
> - **Points:** each card has a point value between 0 and 11.
> - **The deal:** each player is dealt a 6 card hand with 2 cards dealt to the blind.
> - **Picking:** players go around the table deciding if their hand is strong enough to pick up the blind and play 2v3 against the other players with a secret partner.
> - **Play:** following suit with standard trick-taking mechanics.
> - **The partner:** only revealed when a particular card is played (either the Jack of Diamonds or one of the non-trump Aces, depending which game mode is being played).
> - **Winning:** the team that ends the hand with the majority of the points in the deck (more than 60) wins the hand and is assigned a score based on how many points they took.
>
> Sheepshead is zero-sum, so the scores added to one team are subtracted from the other, which makes it a great game to play for small sums of money if you're so inclined.
{: .callout data-title="Sheepshead Rules"}


A few properties of Sheepshead make it an interesting and challenging testbed: It is an imperfect information game that requires both competition and collaboration across unfixed, asymmetric teams. This means the agent has to learn to work with some players against other players all while operating in an uncertain and highly random environment where the player roles are revealed during the game itself.

None of the famous results in game AI that I'm familiar with have all of these properties. Chess and Go are both perfect information 1v1 games. Poker is imperfect information but individual. Dota 2 is imperfect information and team based, but the teams are known at the start of the game not revealed through play (it's also continuous instead of discrete, which is a different can of worms). There is some prior art on trick taking card games, particularly bridge which is one of the more complex of the genre. Bridge has a bidding phase similar in spirit to Sheepshead's picking phase. But bridge does not have asymmetric hidden teams, and in bridge scoring is fundamentally tied to taking tricks, whereas in Sheepshead it is based on the points _in_ those tricks, an added layer of complexity. This doesn't necessarily mean Sheepshead is inherently harder to learn than all of these other games, but it does provide a complex and challenging domain with an interesting combination of constraints.

On top of the domain complexity, one additional challenge in my case is that I have access to _significantly_ less compute than the research groups tackling these earlier problems. The entire training pipeline has to run on my 5 year old M1 Max Macbook Pro.

My goal was to train an expert AI agent that is able to play Sheepshead at or above the skill of the best humans with access only to information that humans have at any given point in the game. I didn't want to give the agent any advantage that a human does not have, forcing the neural network to make strategic moves only from the current state of play and its own memory of the game history, just like a human. And my goal was to train this system entirely from self play samples without providing any external examples of good human play behavior, forcing the network to uncover good strategic play on its own.

> The entire training pipeline has to run on my 5 year old M1 Max Macbook Pro.
{: .pullquote}

After a long journey of discovery, trial, and error I'm pleased to reveal the trained neural network agent. It is available to play against directly and with others online at [Sheepshead.ai](https://sheepshead.ai). Please check it out! I believe it to be the strongest Sheepshead AI available anywhere and should rival expert human play. However, it's difficult to gauge its exact strength against humans without significant human play data. So one of the main goals of the sheepshead.ai site is to gather this data.

Along the way I learned a tremendous amount about the current state of reinforcement learning and even combined some statistical techniques in what I _believe_ is a novel approach to effectively distilling Monte Carlo tree search from noisy samples. I dubbed this technique [Borrowed-Strength Search Distillation](#borrowed-strength-search-distillation). The rest of this article details exactly how the system was created and trained. All code is available under the Apache license on GitHub: [https://github.com/adamanthil/sheepsheadai](https://github.com/adamanthil/sheepsheadai)

---
#### Project Constraints

As far as I'm aware, Sheepshead is a completely untapped domain in machine learning literature, meaning there isn't an existing technique or solution that's already been validated. This was a huge positive to me going into this project.

My guiding design constraint was to train a single system to achieve the closest possible analog to what the human brain does when playing the game. This applies to both raw state observation and the recall of previous states. At a human Sheepshead table, you are generally not allowed to reference earlier tricks, the cards you buried, etc.[^sheepshead-recall] and you certainly aren't allowed to write anything down to help yourself keep track of something. If my Oma Finke would have considered it cheating, the network shouldn't have access to it.

> If my Oma Finke would have considered it cheating, the network shouldn't have access to it.
{: .pullquote .right}

Many machine learning techniques use domain-aware [feature engineering](https://en.wikipedia.org/wiki/Feature_engineering) to make the machine learning problem more tractable by precomputing aspects of the game and including that in the state observation. In the case of Sheepshead this might mean passing derived information like who the partner is, how many points each team has already taken, how many trump cards are left, or adding the full trick history to each observation. These all violate the Oma Finke rule. If it's important, the network needs to learn its own internal representation of the concept, not be fed it as a feature in the observation. I wanted a network where only the current state observation goes in one end and a probability distribution over legal actions comes out the other.

I also wanted to restrict learning to self-play samples. I didn't have access to enough high quality human play data to use for [supervised machine learning](https://en.wikipedia.org/wiki/Supervised_learning), and there is a purity and elegance to self play methods. With the right algorithm I expected self-play would not hinder the overall strength, given recent successful examples such as [AlphaGo Zero](https://www.nature.com/articles/nature24270). And in fact, it should be preferable conceptually since self-play would not bias the agent toward potentially weaker human conventions. One ulterior motive behind this approach was to also serve the Sheepshead nerd in me and determine _if_ certain human play conventions actually are optimal play behavior. If the agent uncovered and kept the same conventions naturally, that would be evidence that they are ideal. Self play reinforcement learning served this secondary goal well.

On training pipeline, algorithm, and architecture I had only two real requirements: 1) it needed to be small and efficient enough to run on my laptop, and 2) I wanted a general training pipeline that didn't lean heavily on Sheepshead-specific idiosyncrasies. At the outset I intended to use a deep neural network, which is the modern standard and is a [universal function approximator](https://en.wikipedia.org/wiki/Universal_approximation_theorem) that should be able to handle any complex task. But the specific architecture and training system went through many iterations.

---
#### Training Pipeline

The final training pipeline combines multiple techniques into four stages that each build on one another. The summary for machine learning practitioners and any large language models in the audience:

> It starts with self-play policy-gradient PPO using shaped rewards for 400k hands; then pre-trains an oracle critic with access to the full game state, and proceeds to multiple generations of terminal reward league-based PPO with centralized training, decentralized execution (CTDE); and finally refines play via expert iteration (ExIt), with information-set Monte Carlo tree search (ISMCTS) as the expert teacher.
{: .callout data-title="The short version"}

Don't worry if that all sounds like technobabble. The workings of this [Retro Encabulator](https://www.youtube.com/watch?v=RXJKdh1KZ0w) are fully explained in the sections that follow.

{% include sheepshead/training-program.html caption="The training pipeline. Click a stage for its method, purpose and stopping rule, or a dotted term for a definition." %}

##### Bootstrap Phase

PPO, or [Proximal Policy Optimization](https://arxiv.org/abs/1707.06347), is a ubiquitous reinforcement learning algorithm that was developed by researchers at OpenAI in 2017, before they became the LLM company we know today. It was used famously to train the [OpenAI Five](https://arxiv.org/abs/1912.06680) Dota 2 agent and has been the go-to policy-gradient RL algorithm since it was introduced. In reinforcement learning, the function that produces actions in a given state is called the "policy" and is abbreviated with the Greek letter π. In our case, the policy is a neural network which takes in a player's observation of the game state and returns a probability for each legal move (or action) in that state. In the bootstrap phase, the agent plays games against 4 copies of itself for roughly 120 hands (4096 total decisions) by choosing actions according to these probabilities at each decision point. When it starts these probabilities are _completely random_, and the network plays terribly. For each batch of decisions, PPO then runs an update step that calculates the "reward" received by each action decision and compares it against what it _thought_ the reward would be. The difference between the actual reward and the predicted reward produces an estimate of the gradient, hence "policy gradient", that an optimization algorithm can follow to tweak the policy parameters (i.e. network weights). The optimizer adjusts the neural network so that actions that produced a higher reward than expected become slightly more likely, and those that produced a lower reward than expected become slightly less likely.

The big innovation of PPO (the "proximal" part) is that this update is clipped each batch, so that one update is unable to move the probabilities too far. That prevents a string of bad luck in a single set of samples from throwing the agent off course. It forces it to instead make slow, steady progress that incorporates many samples and generalizes the overall problem better in practice. This process proceeds thousands of times in the bootstrap phase, enough to play 400,000 hands, and by the end the network is halfway decent at playing the game.

So what is the reward referenced above? The primary reward is the final score of the game itself (divided by 12 to generally fall between -1 and +1). However, the initial bootstrap phase is the only place where some strategic hints are allowed in the training pipeline in the form of shaped rewards. The full reward table can be found [here].

This is the one small allowance I made to providing external strategy guidance. The shaped rewards are small nudges compared to the rewards from the final score and drop off after the bootstrap phase. They were added to jump start the early phase of training on my meagre compute hardware and to help prevent the random, unskilled network from falling into the proverbial ditch and always passing. When playing randomly, whether to pick or not is a coin flip so picking is incredibly risky and most often results in a large negative reward. Without strategic hints the network would consistently diverge into always-pass behavior and the policy would generate nothing but [leaster](https://en.wikipedia.org/wiki/Sheepshead_(card_game)#Leasters) samples. Even with mild nudges from reward shaping, the network learned to always pass within the first 10-20k hands or so on every attempt and architecture variation used throughout the program, but it usually pulled itself out of this trough eventually.[^entropy-watchdog]

The final score of the game itself is used as the only reward for all stages past the bootstrap phase. And the entropy[^entropy] is high enough coming out of the short bootstrap phase that it can easily unlearn any bias introduced by reward shaping. For example, the agent picks too aggressively after the bootstrap phase, but that is corrected quickly in league training.

##### League Phase

The league phase (called prioritized fictitious self-play) allows the agent to learn unbiased from the terminal reward and generalize better play without fitting to idiosyncrasies of its own current behavior. This is a common pitfall of pure self play methods where the training agent controls all players. It is possible for an agent to overfit to its own peculiar play tendencies and forget how to handle more diverse strategies. In league play, it avoids this by playing a rotating set of strong copies of itself from the past. When generating play samples, the training agent always takes one seat at the table. Then for each of the 4 additional seats there is a 15% chance the training agent will also take it and an 85% chance that player will be drawn from past snapshots, with greater weight toward those snapshots that are most evenly matched with the "hero" being trained.

> If the player loses, but by less than expected, it was probably a good move even though the reward may be negative.
{: .pullquote}

As discussed above, PPO and other policy-gradient methods work by iteratively following a gradient toward the actions likely to produce the highest reward. This gradient is extracted from a batch of samples and used by an optimization algorithm (such as [Adam](https://arxiv.org/abs/1412.6980)) to nudge the network weights so the updated agent produces actions slightly more likely to return a higher reward. This process is repeated many thousands of times and slowly the network learns and improves.

But each sample generated by play is very noisy. In the case of a card game, the correct move might not yield a positive reward in any given case. It's quite likely that even the right move results in a loss much of the time either because the other agents have better cards, or subsequent bad play behavior results in a loss, etc. Most reinforcement learning algorithms have some method to reduce this variance in each training sample to extract a cleaner gradient for the optimizer to follow. One of the most popular methods is to train a separate "critic" network to predict the expected final reward at each game state. This is _how_ the bootstrap phase described above predicts what the reward will be. With some minor adjustments, this predicted value is then subtracted from the reward actually received. This results in a more accurate estimate of whether the move taken was better or worse than expected in that scenario. For example, conceptually if the player loses, but by less than expected, it was probably a good move even though the reward may be negative. PPO always uses a critic for this, but typically (and in the bootstrap phase) this critic only has access to the private state observation of the training agent. We call this the "limited critic." If we instead give a new critic access to all hidden information in the game (the "oracle critic"), it is able to remove more of this variance and hand the optimizer a cleaner learning signal for each model update. This "oracle" critic is not deployed and does not share hidden information with the network being trained. It only exists at training time to reduce the noisy training signal. This centralized critic with access to the full game state and all privileged information is the other key change in the league phase.

The bulk of deep strategic learning happens in this oracle critic league phase, as well as roughly half of the training time. By the time the phase completes, the agent is quite good at playing the game. But there is still more room for improvement.

##### Policy Iteration Phase

Many of the best game playing agents at the state of the art use some form of Monte Carlo tree search to achieve the highest possible level of skill. This was the core technique behind Deepmind's [groundbreaking results in Go](https://www.nature.com/articles/nature16961), which achieved performance higher than the best humans. Conceptually, Monte-Carlo tree search (MCTS) means randomly trying actions at a given decision point and running the game state forward a number of steps for each one to see how it plays out. This set of actions and game states forms a tree that spreads out into the future. This tree can be searched to determine the best action at any state. This mirrors human strategic thinking in games fairly closely, so it's a sensible model to use.

However, complexity hides in the details. In a multi-agent scenario, the tree branches with each decision of the player and each opponent. Additionally, in a hidden information game there is not one game state, but many thousands of hypothetical game states consistent with the information known by the player. This is called an [information set](https://en.wikipedia.org/wiki/Information_set_(game_theory)) and requires a more complex algorithm called Information Set Monte Carlo Tree Search ([ISMCTS](https://eprints.whiterose.ac.uk/id/eprint/75048/)). This algorithm uses a process dubbed determinization to randomly create many "worlds" with different assortments of hidden cards that are all consistent with what the player has observed so far. (For example, if a player is short a particular suit in the public history they can't be given any cards from that suit in the determinization).

> In a hidden information game there is not one game state, but many thousands of hypothetical game states consistent with the information known by the player.
{: .pullquote}

The algorithm then chooses one world and plays it out, sampling from the neural network policy to guide actions for the player and all opponents. Since the network is already quite good at playing Sheepshead, this produces actions that are reasonable responses to any given scenario. When the chosen path reaches the end of the game, the actual reward (i.e. score / 12) for that path is recorded. For any leaves of the tree that don't reach the end of the game[^ismcts-leaf-rollout], the oracle critic's prediction of the reward is used. This value is fed back up the tree and provides a reward estimate for the particular action chosen at the original decision point. This whole process is then repeated many times by choosing a different "world" and playing the game out in the same manner, feeding each new reward back up the tree and refining the estimate. In our case, we do so between 256 and 1024 times per decision.

In the end, we have an estimate of the reward we expect to receive for choosing any of the actions at a given decision point. And this reward is generally more accurate than what the policy-gradient method of PPO can estimate, plus it is able to better assess branches that the trained policy would be unlikely to follow. However, this estimate is still fairly noisy and depends on how the hidden cards were randomized. So the whole process is repeated a total of 3 times to form a small "committee" that can inform the best decision. And the reward for each action is averaged from the 3 committee values.

When generating training examples, this _entire process_ has to be repeated for every single decision, which is very computationally expensive. With a fast enough machine (or compute cluster, realistically), this process can be run online during play. That is what was done for AlphaGo. But in my case, doing so was not remotely practical. I also wanted to train a single, unified network to produce actions, not simply use the network as one part of a complex game search algorithm.

{% include sheepshead/search-walkthrough.html caption="One first-trick lead from the first policy iteration, searched the way training searches it: three searches of 1,024 simulations each. Results are game score ÷ 12." %}

The solution to this was to [distill](https://en.wikipedia.org/wiki/Knowledge_distillation) the results of this complex ISMCTS algorithm into the neural network itself. Effectively, the search algorithm functions as a Sheepshead expert and "teaches" the neural network how to refine its play behavior to be even better. This is done over multiple iterations (hence Policy Iteration or Expert Iteration (ExIt), as it is also called). To do this, the ISMCTS search algorithm outlined above plays against itself for 8000 hands, generating roughly 135k play decisions. Generating these play examples is very slow and takes approximately as long as playing 1 million hands in the league phase. These examples are then used as a pattern to tweak the model's weights so that the network itself produces an output closer to the complex tree search algorithm. Since tree search only refines card play behavior, a short 200k episode PPO phase is run next with most of the network frozen. This step only allows updating the bidding "heads" of the model (pick/pass/partner decisions). The updated network is then used in another search phase and the whole process is repeated until updates no longer show any progress, giving us our final expert model.

There's more to say about the specific search implementation, distillation method, and motivations included in the [Borrowed-Strength Search Distillation](#borrowed-strength-search-distillation) section below. It's the most complex and novel part of the program.

{% include chart.html data=site.data.sheepshead.strength expand=true caption="Each point is the agent at that stage of training, playing the same deals against the same fixed opponents. The scale only means something in relative terms: the gap between two points is how many more points per hand one agent wins than the other against this field." note="The “30M agent” is a network trained for 30 million hands using a simpler, early version of the training pipeline that used shaped rewards for much longer, did not use an oracle critic, and did not use search." %}

#### Network Architecture

The neural network architecture went through many iterations, starting with a simple [multilayer perceptron](https://en.wikipedia.org/wiki/Multilayer_perceptron) with [one-hot vector](https://en.wikipedia.org/wiki/One-hot#Machine_learning_and_statistics) state (the classic and simplest deep neural network architecture), but the final form allows better expressivity by using embedding tokens to represent each card in the observation and feeds distinct output heads for the different types of actions. In total, the final network architecture has just over 1.1M parameters, including the shared encoder "trunk" plus the actor and limited critic.

> | Encoder (shared trunk) | 683,848 |
> | Actor | 192,069 |
> | Critic | 244,426 |
> |===
> | Total | 1,120,343 |
> | Oracle critic (training only) | 624,272 |
{: .callout data-title="Network parameters"}

Embeddings are one dimensional vectors that are commonly used in natural language processing to represent words or portions of words. They are famous now in the world of large language models. Each "token" that is produced and billed by the model providers represents an embedding vector in the model. But embeddings do not have to represent text. They can represent any concept at all, and the fact that they are vectors allows similar concepts to be "close" to each other in vector space. This allows for much easier and more sample-efficient generalization. In the case of our Sheepshead model, each embedding vector represents a card.

In terms of what the model does with these vectors, each suit might represent a different dimension in the embedding space for a card, point values another, and the relative power of the card another. This means that cards of the same suit or similar power are clustered together in vector space. And when the network learns the Queen of Clubs (the highest trump card in Sheepshead) is a good play in a particular context, that same lesson applies very closely to the Queen of Spades (the 2nd highest trump card). This framework also allowed me to seed the dimensions of the embedding vectors for each card with their inherent suit, power, and points values, so the network did not have to independently construct these values through the learning process from only the final score. This is no violation of my state observation rules either since human players also know the relative strength and suits of every card.

{% include embed.html src="/assets/sheepshead/network.html#preview" poster="/images/posts/sheepshead-network.jpg" title="Interactive 3D walkthrough of the Sheepshead network" caption="One real decision passing through the final network. Click to open the full walkthrough, which steps through each part of the network and the oracle critic for five decisions from the same hand." %}

For the neural network then, the observed state is the embedding vectors for each card in hand or on the table, projected through a linear network layer that adds the context for that card (whether it is in hand or in the trick, and if it's in the trick which player played it). Two additional tokens are also added: One for the overall game context that includes public game rules such as which partner mode is being played, what distance the player is from the dealer, who picked if there is already a picker, etc.; and a 2nd token representing the network's learned memory from the last observation (empty at the start of the game).[^memory-token]

These tokens are fed through a small [transformer](https://en.wikipedia.org/wiki/Transformer_(deep_learning)) to allow them to add learned context to each other through the attention mechanism. This learned context might be things like: In the current context the Jack of Spades in hand would take the trick, or this card is in the called suit, etc. The post-attention tokens are then read out via learned queries that feed a linear adapter and different network [heads](https://medium.com/@AILearningHub/neural-network-heads-16ce560c0b10) for each type of possible action and the limited critic.

##### Auxiliary Heads

A neural network "head" describes its final set of layers. Having multiple heads simply means that the same core network is able to produce different types of output. For instance, scoring a card token for "play" actions requires a different format for the output layers than producing a probability distribution over pick/pass actions or a scalar value estimate for the limited critic's reward prediction. Multiple heads allow a single network to produce all of these types of output using a shared backbone.

Adding additional output heads was also used as a teaching technique in the case of the Sheepshead AI agent to force the network to keep track of valuable game details that are useful in making strategic play decisions. For example, knowing exactly which trump have already been played and how many points each person has taken are key pieces of data that should inform strong strategic play in the late game. This is all public play information that requires mental bookkeeping, but I wanted to ensure that the network was doing this bookkeeping in a way that could be relied on when choosing which card to play. The solution was to add additional "auxiliary" heads to the critic branch of the network that predict deterministic values of high strategic importance. In particular, those values are:

> * _secret_partner_: Probability that the agent is secretly the partner, holding the partner card in their hand
> * _seen_trump_: For each of the 14 trump cards, a probability that the agent has already seen it either in their hand or on the table
> * _unseen_higher_: Probability that there is a trump still unaccounted for that is higher than any in the agent's hand. The inverse of "do I hold the high card?"
> * _points_vector_: Per-seat point predictions (0–120) in relative seat order.
{: .callout data-title="Auxiliary Network Heads"}

In the case of the first 3 "probability" heads, ground truth is either 0% or 100% and is fully derivable from play history. Their outputs eventually converge to this binary around the end of the league phase.[^aux-heads-gate]

The _secret_partner_ head was the first of these auxiliary heads added relatively early in the program. Prior to this, when the agent was secretly the partner it was not reliably making partner-like play decisions. By Sheepshead convention, partners, even hidden ones, should lead trump and defenders should lead "fail" (non trump suits). The classic explanation for this behavior is that the picker should have more and higher trump in hand than any of the defenders, so leading trump bleeds the defenders out of their trump and allows the picker to take the trick. The converse is true about defenders. They should lead fail to avoid bleeding their own team out of the rare trump they have, instead allowing teammates to strategically trump in when they can. Later tree search validated these conventional behaviors are correct nearly 100% of the time. However, prior to adding the _secret_partner_ prediction head the agent's behavior was a muddy generalization between the two extremes. Secret partners would often lead fail and defenders would sometimes lead trump. Partner agents who were already publicly revealed (and thus had their role included in game context) would lead trump pretty reliably, but before they were revealed the correct behavior was inconsistent. After this head was added and trained, the behavior shifted almost immediately and the network started leading trump reliably as the secret partner. Adding the auxiliary prediction head forced the network backbone to carry inferred information on the role, which could then easily be used by the play head to select a more optimal card.

> The network's job is just as complicated, but these auxiliary tasks make it easier to learn.
{: .pullquote .right}

After the success of using an auxiliary head to "teach" the network about the secret partner role, I added the other three deterministic prediction heads to encourage more advanced strategic play at later training phases. Conceptually, the auxiliary heads force the network to focus on certain aspects of the game that are easier to learn. This essentially breaks down the highly complex problem of "What card do I play?" into more manageable pieces that can then build on each other. I preferred this auxiliary head approach over the feature engineering style methods discussed earlier because it is a principled way to force the network to learn how to do a complex task. It is not doing part of the complex task in place of the network. The network's job is just as complicated, but these auxiliary tasks make it easier to learn. I thought it was analogous to a teacher telling the student what to focus on to become a better player. But the student (i.e. the neural network itself) still has to learn how to do everything itself just like a human would.

##### Architecture Ablation

As more complexity was added to the network architecture in the form of embeddings, auxiliary heads, the transformer layers, etc., the network was able to become a better player faster. However, the success of these architecture changes was confounded with the simultaneous evolution of the training algorithm itself and some persistent bugs in the PPO implementation.

As a result, after the training pipeline was firmly established, I ran an [ablation study](https://en.wikipedia.org/wiki/Ablation_(artificial_intelligence)) on increasingly complex architectures over the bootstrap phase to determine the relative impact of each addition to the final network. It was gratifying to see that the final architecture performed as well as or better than every earlier version, and far better than the baseline in this analysis.

{% include chart.html data=site.data.sheepshead.ablation expand=true caption="Hover or tap a row to highlight that architecture and show its three training seeds. The number on the right is its score at 400k hands." %}

Initially, adding embedding tokens without seeding them with card details actually performed significantly worse than the simple one-hot MLP baseline. And it took informed initialization (adding card point and power data) and a transformer to reach the same ending skill level as the basic baseline through the bootstrap phase. As architecture complexity and expressiveness increases, so do unexpected bottlenecks, sensitivity to external configuration variables, and other learning challenges.

Each step adds something that in principle makes the network more powerful. The transformer adds more nuanced information to each token (step 4), auxiliary heads force state differentiation (step 5), and the learned queries add expressiveness to the readout (step 6). The final change, adding the bilinear term to the play head, allows the network to more easily condition the value of specific card plays on the particular network state (i.e. "This card is best, but only in this situation"). All of those combined offer a rich and expressive system for learning from patterns in the play data and handily outperform the simple MLP baseline as a composite system. But not all additions offer clear benefits in isolation, at least during the bootstrap phase. In this phase, the baseline is somewhat hard to beat without significant additional network complexity. Also noteworthy is the slope of each agent's skill level. The baseline MLP is gaining skill more slowly at the 400k episode mark compared with all of the embedding architectures.[^ablation-slope]

Consistent with my observations, adding the auxiliary heads yielded the single biggest boost in performance. And since each change is cumulative, it's possible that the performance boost of the auxiliary heads was enhanced by the richer structure of embedding tokens and the transformer. Determining that conclusively would require more ablation runs.

Finally, the most expressive architectures theoretically unlock a higher skill ceiling by their construction and set the program up for achieving strong performance in the later phases. Both the measured skill of the final (step 7) architecture and its learning slope are consistent with this, but more analysis could be done to determine the optimal and most efficient architecture.

#### Learning Sheepshead Conventions

My original plan was for training to end after the league phase reached a skill plateau. However, after training an early agent for 30 million league episodes[^30M-agent] I was still dissatisfied by its strength and performance. Overall it exhibited competent play behavior that was fairly strong, but there were a few conventional Sheepshead play strategies that it did not always use. And I also suspected that these inconsistent behaviors hinted at some deeper flaws that were harder to enumerate. The particular Sheepshead conventions I expected to see were:

> 1. As a defender, trump should never be led unless there are no other options
> 2. As a partner, trump should almost always be led
> 3. In called ace partner mode, the suit of the called ace (i.e. the "called suit") should always be led on the first trick by defenders if given the opportunity
{: .callout data-title="Benchmark conventions"}

For this analysis we will focus on the 1st and 3rd conventions, which are the most ironclad in human play.

One possibility of course was that these human conventions aren't actually optimal. No one has fully "solved" the game of Sheepshead. Perhaps the network learned a better strategy? In order to determine whether these conventions _should_ be followed, I built the ISMCTS tree search algorithm outlined earlier. That allowed me to use the very computationally intensive search process to determine more reliably if a particular behavior was actually optimal. For these initial tests I ran searches with 4096 iterations all the way to the terminal reward (to avoid any critic bias) and determined that all three of these conventions are indeed optimal in almost all cases (at least under self-play with the competent agent I had trained thus far). There are a few possible exceptions in some narrow corner cases, but the 30M episode agent referenced above played more sloppily and didn't follow the conventions where they were always correct.

Beyond just a skilled agent, I wanted one that was fun to play against. And if the AI player defied ironclad human play conventions in a way that caused your team to lose that would be incredibly frustrating. Not reliably following convention #1 was the most egregious in this regard. Someone who is not the picker leading trump is a clear signal to the table that they are the partner. If they turn out to instead be a defender and have thrown off everyone's expectations, bled their team out of trump, and caused missed schmear opportunities, that does not make for a fun play experience. Thus I wanted the defender trump lead rate to be as close to 0% as possible. And if it deviated, it should be justified by the game results. Similarly, leading the called suit as a defender on the first trick is expected in human play. The picker and partner are both guaranteed to have that suit, so it is the best opportunity for the defending team to trump a suit and get points. It also reveals to the table who the hidden partner is, which is useful for coordinating defense. If a teammate does not lead the called suit when it could be trumped but waits until later when their teammates are out of trump, that is also quite frustrating.

> Beyond just a skilled agent, I wanted one that was fun to play against.
{: .pullquote .right}

The agent referenced earlier that had trained for 30 million hands was produced by a self-play bootstrap phase followed by league training using its own limited critic. It did not use the oracle critic or search. It also trained under shaped rewards for the first 15 million hands, followed by 15 million additional hands with terminal-only rewards. Under this scheme, all of the formative training was done when there were hand-written rewards specifically tailored to produce the conventions listed above. Only after dropping the shaped rewards was the agent able to learn unbiased play behavior from the final score. But by that time the probability distribution for each action had ossified and it was difficult for the network to unlearn any bias introduced by those hand-tuned rewards. Even so, this "30M" agent was still somewhat inconsistent in following the important play conventions.

Adding the oracle critic to the league phase, while also switching to terminal rewards for that whole phase, was the first attempt to improve these behaviors (the centralized training, decentralized execution approach mentioned in the league section above). In theory, the centralized oracle critic should remove more of the noise from each training example and allow dropping the shaped rewards while still extracting the signal that those conventions are optimal. This produced an agent that was better in overall skill. The agent also deviated from the play conventions in a way that was less random and more motivated by consistent patterns in the data. However, it still did not exhibit optimal convention play behavior, and was actually worse in overall adherence rate than the 30M agent on convention #1.

This is finally what motivated adding the ExIt phase and search distillation to the training pipeline. The best way to ensure the agent followed what search determined was the optimal convention was to learn directly from the search algorithm's outputs. It also gave a notable bump in overall skill.

{% include chart.html data=site.data.sheepshead.conventions expand=true caption="Measured over 100,000 hands per partner mode for each agent, on the same deals, with every seat playing its most likely action. Dots are rates and whiskers are 95% intervals." %}

On the production pipeline, the convention adherence is significantly better after the ExIt phase than after league training alone. There are some deviations in convention #1, but they all follow clear patterns in corner cases where the search algorithm found the convention's value ambiguous or slightly worse than the alternative. And qualitatively, the agent fine-tuned through search distillation feels like a strong, strategic opponent or partner.

#### Borrowed-Strength Search Distillation

The following section describes the novel search distillation method in detail and is heavier on math and terminology. If you're willing to stick with me here, I try to lay it out clearly. But some deeper statistics and machine learning knowledge is assumed. For the half dozen readers and language models still with me, I appreciate you!
{: .note}

Cleanly distilling the ISMCTS behavior into the model was challenging due to the noisy results produced by the search algorithm. The nature of the stochastic environment means that even with hundreds or thousands of simulations the true advantage can be hard to accurately measure in any individual case. But the distillation needs a clear and reliable target to update the network weights in a way that won't just add noise to play behavior. This is even more the case with very small advantages, as is true at some human play convention decision nodes.

The clearest example is the called suit lead convention (convention #3). On the first trick, leading the conventional called suit beats all other cards by only ~0.024 Q (~0.29 additional points taken per hand). A single committee of three 1024 iteration searches measures that edge with a standard error of ~0.015 Q (~0.18 points per hand). This fails to clear 2σ of the noise floor. The committee can't reliably distinguish the convention's edge from zero. It generally points in the right direction, but makes a very noisy target that would be difficult for the network to learn. If the raw Q values were used to update the network directly, it could easily fit to the noise instead of the signal and degrade behavior in these cases or others that appear similar. That is the kind of behavior already exhibited by the early 30 million episode league agent, albeit via PPO training instead of search distillation. It produced behavior that usually followed the conventions but in a small number of cases seemed to buck those conventions at random, sometimes causing swings in the final results of the hand.

Pooling advantages across many similar decisions fixes this and produces a much cleaner signal. When averaged across 1,058 first trick defender leads, the advantage of leading called suit carries a standard error of only 0.0007 Q (0.008 game points) against the ~0.024 Q signal— much clearer! To use classic statistical terminology, this is "borrowing strength" from related data to improve our accuracy and precision.

{% include chart.html data=site.data.sheepshead.pooling expand=true caption="The single-search interval uses the committee's typical standard error of 0.015 Q. The spread of the individual searches is partly that noise and partly real differences between hands." %}

But how do we apply pooling to the distillation itself? This particular example case uses a hand-defined pool of decisions where the agent is a defender and holds the called suit on the first trick. The numbers look different on other tricks and play states. And I did not want to hand-define classes for pooling, but instead build a general method that would use the data itself to define the pools. This was done by building an advantage model (which is itself a neural network) that learns to predict the search committee's advantage value for each node. The advantage model pools the data in proportion to how similar the states appear, performing a nonlinear [regression](https://en.wikipedia.org/wiki/Regression_analysis) over the search Q values.

In addition to this pooled model, we also want to lean on the direct search measurement at each node for cases where it is reliable and more informative than the pooled estimate. Sometimes the model can incorrectly generalize, and if the search estimate is accurate we should use that instead.

> Borrowed-Strength Search Distillation (BSSD) pools action advantages over similar situations, as the network itself sees them, and lets each node's own search override the pooled estimate in proportion to the precision of the search measurement. Decision nodes with confident searches learn primarily from the search labels themselves, and nodes with noisy searches or weak signals lean on the model.
{: .callout data-title="The core idea"}

BSSD uses the foundational [Fay-Herriot method](https://en.wikipedia.org/wiki/Fay%E2%80%93Herriot_model) from survey statistics to blend the pooled advantage model with the direct search measurements at each node. This is a seminal technique for small area estimation that combines noisy but direct measurements with a clean but indirect, modeled estimate of the same value. This method was originally introduced in 1979 to solve a problem at the US Census Bureau: How to get reliable per-capita income estimates for thousands of small towns and counties (i.e. small areas) where there were only a few survey respondents. The solution was to borrow strength by building a model to predict income from auxiliary data and then blend that prediction with the survey responses.

In our case, each decision node is a "small area", with its direct measurements being the relative search Q values for each action. The pooled advantage model trained via supervised learning then provides the cleaner indirect estimate at each decision node. And the two are combined via the following formula:

> $$
> \hat{a}_a = \gamma\, y_a + (1 - \gamma)\, m_a
> $$
>
> $$\hat{a}_a$$
> : blended advantage of action $$a$$
>
> $$\gamma$$
> : the weight on the node's own search vs the advantage model
>
> $$y_a$$
> : search label, the committee's mean Q for $$a$$ centered over the legal actions
>
> $$m_a$$
> : model estimate of $$a$$'s centered advantage from $$\theta_k$$'s features
{: .equation}

Here, $$\gamma$$ is the weight of the advantage estimate given to the average of the direct search committee values. A value of 1.0 means search determines the entire advantage at a particular node, and a value of 0.0 means the model does.

The advantage model itself is trained from the encoder network's own frozen outputs using supervised learning to predict the "centered" advantage of every legal card. Advantage centering subtracts the average estimated advantage of all legal actions from each individual advantage estimate, so that we are predicting the _relative_ strength of each play instead of the absolute strength. That makes model training cleaner by focusing only on the relative value difference between cards and canceling much of the search noise.

The advantage model is itself a neural network that mirrors the actor network exactly in inputs and network shape, taking the post-attention hand tokens and query readout as inputs and predicting the relative advantage of every legal card in reward units (Q) from the other search labels. In order to ensure this model prediction is statistically independent from the search results at any given decision node, the search labels are split into 5 folds, each using 4/5 of the data. This results in 5 separate advantage models. At any given node the model that was not trained on that node's search values is used for the pooled estimate.

The value for the blend between the direct search measurements and the advantage model ($$\gamma$$) is set using the variance of the search committee values and the error estimate of the model at that node via the following formula:

$$
\gamma = \frac{\sigma_u^2}{\sigma_u^2 + s_n^2}
$$

Here $$\sigma_u^2$$ is the model error variance[^model-error-variance] and $$s_n^2$$ is the search noise variance at one node. This allows a confident search result to get more weight relative to a noisy model and vice versa. In the case of the called suit convention, the model was highly confident at those nodes and the search results were noisier. The value for $$\gamma$$ ended up around 0.3 for most of those nodes in the first ExIt iteration, meaning the pooled model got 70% of the weight. Exactly what we hoped for! For late trick decisions on the other hand, especially for the picker, $$\gamma$$ is as high as 0.9 or above. There is not much determinization noise left and search has a clear answer for what the right play is at those nodes.

> ##### The whole step in one line
>
> $$
> t(a) \;\propto\; p_{\theta_k}(a)\,\exp\!\Big(\operatorname{clip}\Big(\dfrac{\overbrace{\gamma\, y_a \;+\; (1-\gamma)\, m_a}^{\hat a\text{: the blended advantage}}}{\eta},\;\pm 8\Big)\Big)
> $$
>
> $$t(a)$$
> : the training target. The network's own policy, shifted toward cards with positive blended advantage.
>
> $$p_{\theta_k}(a)$$
> : the frozen network's own probability for card $$a$$ at this decision.
>
> $$\gamma$$
> : how much to trust this node's search over the model, from the two error variances.
>
> $$y_a$$
> : this node's search value for $$a$$, centered over the legal cards.
>
> $$m_a$$
> : the advantage model's estimate, pooled across similar decisions and fit without this game.
>
>
> $$\eta = 0.0097$$
> : one temperature for every row, in reward units.
{: .equation .long}

The blended advantage $$\hat a$$ that pulls the trained network toward better play behavior is divided by a constant [tilt temperature](https://en.wikipedia.org/wiki/Softmax_function) ($$\eta$$). This value was configured to calibrate the dose to a value that worked in practice. The contribution of each decision is clipped at a separate constant of 8 [nats](https://en.wikipedia.org/wiki/Nat_%28unit%29) (units of natural-log probability) to ensure no sample pulls the distribution too far in one direction. The clip binds at an advantage of approximately 1 Sheepshead game point. This is similar conceptually to the PPO clip discussed in the [bootstrap phase](#bootstrap-phase), and helps keep learning stable.

The network is then trained with cross-entropy toward $$t$$ on every searched play row. The unsearched decision nodes (all pick/partner/bury decisions, plus play for leasters) are pinned to the values the network already produces with 10x weight so they stay fixed through each iteration.

Borrowed-Strength Search Distillation improves the model significantly on both of the measured Sheepshead play conventions while simultaneously boosting overall skill measurably. It is an especially useful technique on a limited compute budget, where running many searches is too slow or costly. But it also improves on raw search labels by efficiently reducing noise via pooling and setting the tilt only as far as the blended evidence supports in each case. It is also self-tuning. Trust is set automatically, node by node, based on the noise and quality of the model's prediction. And it scales cleanly with additional compute. As search noise shrinks, for example with more independent searches per decision, $$\gamma \to 1$$ and BSSD reduces exactly to plain search distillation. I think it would be a valuable technique in other domains as well.

#### Conclusion

I'm happy with how this project came together and with the strength and performance of the final model. In total, the released 1.0 version of the model took roughly 38 days of nonstop training on my M1 Max. I hope people enjoy playing with and against it at [Sheepshead.ai](https://sheepshead.ai). It's quite a challenging opponent. And when you have a couple minutes of downtime, engaging your mind in a hand or two of Sheepshead sure beats mindless scrolling of algorithmic feeds on your phone.

Included there is a [model analysis tool](https://sheepshead.ai/analyze) that allows you to inspect the network's outputs at every step, including action probabilities and auxiliary heads. I think it's fun to see what the model is doing in detail.

I already have a series of optimizations planned for a 2.0 training run that should simplify some of the architecture and pipeline details and hopefully produce a slightly stronger agent. At some point, I'd also like to add [cracking and blitzing](https://en.wikipedia.org/wiki/Sheepshead_(card_game)#Cracking) to the game engine as additional options and train the model to support those as well. But those are all projects for the future.

#### References

**Policy-gradient training**

- Schulman, Wolski, Dhariwal, Radford and Klimov, [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347), 2017. The learning algorithm behind the bootstrap and league phases, including the clipped update that keeps each step small.
- Schulman, Moritz, Levine, Jordan and Abbeel, [High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438), 2015. The standard way to turn rewards and critic predictions into the "better or worse than expected" signal that PPO learns from.
- Ng, Harada and Russell, [Policy Invariance Under Reward Transformations](https://people.eecs.berkeley.edu/~russell/papers/icml99-shaping.pdf), ICML 1999. The classic analysis of when shaped rewards change what an agent ends up learning, and the reason shaping is confined to the bootstrap phase.
- Berner et al., [Dota 2 with Large Scale Deep Reinforcement Learning](https://arxiv.org/abs/1912.06680), 2019. OpenAI Five showed PPO scaling to a complex team game, and its mix of playing the current agent and past versions is the model for the league's seat assignment.

**League play and the oracle critic**

- Vinyals et al., [Grandmaster level in StarCraft II using multi-agent reinforcement learning](https://www.nature.com/articles/s41586-019-1724-z), Nature, 2019. AlphaStar introduced prioritized fictitious self-play, the method the league phase uses to choose opponents from past snapshots.
- Pinto, Andrychowicz, Welinder, Zaremba and Abbeel, [Asymmetric Actor Critic for Image-Based Robot Learning](https://arxiv.org/abs/1710.06542), 2017. The idea of giving the critic information that the acting policy never sees, which is what the oracle critic does.
- Yu et al., [The Surprising Effectiveness of PPO in Cooperative, Multi-Agent Games](https://arxiv.org/abs/2103.01955), 2021. Showed that plain PPO with a centralized critic is a strong method in multi-agent games.
- Li et al., [Suphx: Mastering Mahjong with Deep Reinforcement Learning](https://arxiv.org/abs/2003.13590), 2020. A precedent for training with an "oracle" that sees the hidden tiles in another hidden-information game.

**Network architecture**

- Vaswani et al., [Attention Is All You Need](https://arxiv.org/abs/1706.03762), 2017. The transformer, used here to let the card tokens exchange context with each other.
- Cho et al., [Learning Phrase Representations using RNN Encoder-Decoder for Statistical Machine Translation](https://arxiv.org/abs/1406.1078), 2014. Introduced the gated recurrent unit, which carries the network's memory from one decision to the next.
- Vinyals, Fortunato and Jaitly, [Pointer Networks](https://arxiv.org/abs/1506.03134), 2015. The basis for a play head that scores each card in the hand directly rather than choosing from a fixed list of outputs.
- Jaegle et al., [Perceiver IO: A General Architecture for Structured Inputs & Outputs](https://arxiv.org/abs/2107.14795), 2021. The source of the learned-query readout that summarizes the tokens for the output heads.
- Wu, [Accelerating Self-Play Learning in Go](https://arxiv.org/abs/1902.10565), 2019. KataGo demonstrated that auxiliary prediction targets help a game-playing network learn faster, the same idea as the auxiliary heads.

**Search and expert iteration**

- Silver et al., [Mastering the game of Go with deep neural networks and tree search](https://www.nature.com/articles/nature16961), Nature, 2016. AlphaGo combined Monte Carlo tree search with a neural network that proposes moves and a critic that evaluates positions.
- Silver et al., [Mastering the game of Go without human knowledge](https://www.nature.com/articles/nature24270), Nature, 2017. AlphaGo Zero learned from self-play alone by training its network to match the results of its own search.
- Anthony, Tian and Barber, [Thinking Fast and Slow with Deep Learning and Tree Search](https://arxiv.org/abs/1705.08439), 2017. Expert Iteration, the loop of searching with the current network and then training the network on what the search found.
- Cowling, Powley and Whitehouse, [Information Set Monte Carlo Tree Search](https://eprints.whiterose.ac.uk/id/eprint/75048/), IEEE Transactions on Computational Intelligence and AI in Games, 2012. The tree search algorithm for hidden-information games that the search phase implements.
- Hinton, Vinyals and Dean, [Distilling the Knowledge in a Neural Network](https://arxiv.org/abs/1503.02531), 2015. The original description of training one model to reproduce the outputs of a stronger but more expensive one.

**Borrowed-Strength Search Distillation**

- Fay and Herriot, [Estimates of Income for Small Places: An Application of James-Stein Procedures to Census Data](https://doi.org/10.1080/01621459.1979.10482505), Journal of the American Statistical Association, 1979. The method for blending a noisy direct measurement with a model's prediction according to how precise each one is.
- Efron and Morris, [Data Analysis Using Stein's Estimator and Its Generalizations](https://doi.org/10.1080/01621459.1975.10479864), Journal of the American Statistical Association, 1975. An accessible treatment of shrinkage estimation, the statistical idea underneath "borrowing strength".
- Peng, Kumar, Zhang and Levine, [Advantage-Weighted Regression: Simple and Scalable Off-Policy Reinforcement Learning](https://arxiv.org/abs/1910.00177), 2019. The form of the training target: the current policy reweighted by an exponential of each action's advantage, with a temperature and a clip.
- Grill et al., [Monte-Carlo Tree Search as Regularized Policy Optimization](https://arxiv.org/abs/2007.12509), 2020. The theory for why tilting the network's own policy toward higher-valued actions is a principled, bounded improvement step.
- Li and Hoiem, [Learning without Forgetting](https://arxiv.org/abs/1606.09282), 2016. The technique of pinning a network's existing outputs while it trains on something new, used here to hold the decisions that search does not cover.

---

[^sheepshead-recall]: Technically in most competitive Sheepshead tournaments you are allowed to reference the last trick played up until all cards are played on the current trick. But this isn't completely universal and it's cleaner and in spirit with these rules to simply disallow referencing any previous tricks.

[^entropy-watchdog]: The training script has an "entropy watchdog" for this purpose, which adds entropy to the pick head of the network if it falls into this always-pass trap, forcing it to continue picking when it otherwise wouldn't. This allows it to continue seeing "pick" samples so it can find the pattern of cards that actually constitutes a good picking hand. This watchdog returns entropy to normal once the pick rate climbs. Most setups were able to escape the always-pass phase without this, but it was slower and less consistent.

[^entropy]: In machine learning, "entropy" measures how evenly the policy spreads its probability across the available actions. When entropy is higher, the policy is more likely to explore states that it does not currently favor but which _might_ yield better rewards. It also means the policy has not yet committed strongly to any one behavior, so it is still easy to change.

[^ismcts-leaf-rollout]: In the ISMCTS algorithm, the first time a new node is reached, search stops and one more action of the player is sampled from the network and each opponent. On the player's next turn the oracle is used to estimate the expected final reward from that point. If that same state node is reached again through another iteration, search then continues expanding nodes. This saves some computation. Plays that are unlikely to be valuable tend not to waste search resources.

[^memory-token]: After running through the network encoder, this "memory" token feeds a [gated recurrent unit (GRU)](https://en.wikipedia.org/wiki/Gated_recurrent_unit) which stores learned memory between state observations. The output of this GRU is fed into the _next_ observation. This is how the network remembers what was played in previous tricks.

[^aux-heads-gate]: In fact, this is one of the requirements for moving to the final phase of learning. The predictions produced by the auxiliary heads must be almost never wrong before training is allowed to proceed to the policy iteration phase. In that phase, we want the most accurate game information available for refining advanced strategy decisions.

[^ablation-slope]: When averaged over the last 100k hands, the baseline gained +0.05 compared with +0.10 to +0.16 for the other architectures.

[^30M-agent]: This is the "30M agent" referenced earlier in the "Skill through the training pipeline" chart.

[^model-error-variance]: Technically, $$u$$ is the gap between a node's true advantage and the model's prediction, and $$\sigma_u^2$$ is the variance of that gap.
