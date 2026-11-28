# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three audiences, confirmed by the owner:

- **Daily-puzzle players**: people with a Wordle- or Krillion-style habit who play one short puzzle a day and share the result with friends.
- **Cricket fans in India**: IPL followers who know players, seasons and records well enough to dig past the famous names.
- **Geography quiz fans**: JetPunk- and Sporcle-style players who enjoy naming countries.

The job in each case is a few minutes of play: answer seven questions, see how unexpected your answers were, and share the outcome.

## Product Purpose

TriviaSummit is a daily open-answer trivia game. Each pack serves seven questions a day with 30 seconds each. Any correct answer scores, but answers that are less expected for that particular question score more.

Success in the coming months means growing a real public audience of regular players.

## Positioning

Most trivia rewards knowing the right answer; TriviaSummit rewards knowing an unexpected right one. Tiers are judged per question, so an answer that is obvious for one question can be the top-scoring answer for another. There is no fixed list of "rare" answers to memorise.

The cricket pack (IPL, 2008 to the 2026 final, from Cricsheet ball-by-ball data) has no known rare-answer competitor. Geography is a crowded space, and its edge there is the scoring model and the daily format.

## Operating Context

- **A daily ritual**: one climb per pack per day, with new questions at midnight UTC. Puzzles are scheduled 30 days ahead.
- **Sharing**: an emoji result line shared in group chats, as with Wordle.
- **Retries**: players keep guessing until they're right or the 30 seconds run out (at most 10 wrong guesses).
- **A close neighbour**: Boreen (boreen.ie), an Irish daily game with seven questions, 25 seconds each and rarer answers going further along a mapped road. Future work should stay clearly distinct from it, not copy its map or road treatment.

## Capabilities and Constraints

- **Packs**: Geography (195 countries) and Cricket (IPL). One engine serves swappable packs.
- **Scoring**: six tiers named after real mountains:

  | Tier | Points |
  | --- | --- |
  | Everest | 100 |
  | Aconcagua | 85 |
  | Kilimanjaro | 70 |
  | Mont Blanc | 55 |
  | Fuji | 40 |
  | Wycheproof | 20 |

  Tiers are fixed per question before play and never change with live votes. The day's score is shown as altitude: points ÷ 700 × 8,849 m.
- **After a question**: the player sees the answers that are most often given. After finishing, they see five example answers per tier.
- **Answer matching**: the game tolerates typos, aliases and cricket name forms such as initials and surnames.
- **Identity**: no accounts today. An anonymous cookie identifies each player.
- **Stack**: Next.js on Vercel, Supabase Postgres, and a Python data pipeline.
- **Undecided**: whether the game stays free with no sign-up, whether it is designed mobile-first, and whether the share card's format is fixed. The owner chose not to bind these yet.

## Brand Commitments

- **Name**: TriviaSummit.
- **Theme**: mountains. Tiers are real peaks, the score is altitude, and the seven questions are camps.

No other visual or voice commitments have been made binding.

## Evidence on Hand

- **Data**: real question and answer data in `supabase/data/`, built by `pipeline/`. Credits must stay in the footer: mledoze/countries (ODbL), wordfreq (CC BY-SA) and Cricsheet.
- **Absences**: there are no player numbers, testimonials, press or ratings. Do not invent any.

## Product Principles

1. **Fair and fixed.** A player's points never change after they answer.
2. **Per-question surprise.** "Unexpected" is judged for each question, never as general obscurity.
3. **Over in minutes.** The daily climb stays short, and its result is easy to share.
4. **Correct data first.** Every accepted answer must be verifiably right against the source data.
