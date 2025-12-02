- Punishing cards 
    * id config.punishment.aceSpadeCard punish value config.punishment.aceSpadePenality

- GAME PLAY STRATEGY
  * FOR SINGLE CARD THROW
    - when the player throws a card 
        1) see if the card suit is the the same as the currently playing card suit.
            * if true
              1.1) see if the card punihsing card 
                * if card id === config.punishment.aceSpadeCard then punish value config.punishment.aceSpadePenalty
                * if card id === config.punishment.rank2Cards then punish value config.punishment.rank2Penalty
                * if the previous card is config.punishment.aceSpadeCard and the config.punishment.aceOverRule is true and the current playing card is
                    * config.punishment.aceSpade2 then the punishment chain will be added config.punishment.aceSpade2penality more making the punishment chain config.punishment.aceSpadePenality + config.punishment.aceSpade2Penality  
                    * else blunder is made making config.illegalTurnPenalty added to the config.puishment.aceSpadePenality
                * if the card is config.punishment.rank2Cards[0] 
                  * if their a punishement chain started with config.punishment.rank2Cards add config.punishement.rank2Penalty to the next player 
        2) see if the card suit is config.specialCards.reverseCards
            * if true 
                the game play direction will be reveresed and the previous player will continue.
        3) see if the card suit is config.specialCards.skipCards 
            * if true
              the next player will be skipped and the third player will continue playing.
        4) see if the card rank is similar to the current playing card rank 
            * if true continue playing change the suit of the current playig suit to the suit of the card 
            * else see if the card is config.specialCards.suitChangeCards 
              * if true change the suit to the selected suit 
              * else blunder has been made trigger  config.illegalTurnPenalty and the crazy can be saied by the oher users and revert move can be made by the playing user 
                * if crazy is sayed before the playing user sayed revert the playing user will be punished config.illegalTurnPenalty imediatly and the card he thrown will be returned to him and he will continue the game.
                * if revert is sayed before crazy the punishement will be cancled and the thrown card will be returned to the player and he will continue to play the game.
  
  * FOR MULTI CARD THROW
    - when the player throws multiple cards
        1) see if the cards have any different suits within them(or if their is any different suit within the thrown cards list)
          * if true
              * blunder has been made trigger  config.illegalTurnPenalty and the crazy can be saied by the oher users and revert move can be made by the playing user 
                * if crazy is sayed before the playing user sayed revert the playing user will be punished config.illegalTurnPenalty imediatly and the card he thrown will be returned to him and he will continue the game.
                * if revert is sayed before crazy the punishement will be cancled and the thrown card will be returned to the player and he will continue to play the game.
        2) see if the suits of the thrown cards is different to the playing suit 
           * if true
              * blunder has been made trigger  config.illegalTurnPenalty and the crazy can be saied by the oher users and revert move can be made by the playing user 
                * if crazy is sayed before the playing user sayed revert the playing user will be punished config.illegalTurnPenalty imediatly and the card he thrown will be returned to him and he will continue the game.
                * if revert is sayed before crazy the punishement will be cancled and the thrown card will be returned to the player and he will continue to play the game.
        3) see if their is a config.specialCards.dropCards in the thrown cards list
            * if true
                * see if config.allowDropAllSameSuit.
                  * if true 
                    * remove all the selected cards from the player card list and continue the game to the next player
                  * else
                    * blunder has been made trigger  config.illegalTurnPenalty and the crazy can be saied by the oher users and revert move can be made by the playing user 
                      * if crazy is sayed before the playing user sayed revert the playing user will be punished config.illegalTurnPenalty imediatly and the card he thrown will be returned to him and he will continue the game.
                      * if revert is sayed before crazy the punishement will be cancled and the thrown card will be returned to the player and he will continue to play the game.
            * else
                * blunder has been made trigger  config.illegalTurnPenalty and the crazy can be saied by the oher users and revert move can be made by the playing user 
                      * if crazy is sayed before the playing user sayed revert the playing user will be punished config.illegalTurnPenalty imediatly and the card he thrown will be returned to him and he will continue the game.
                      * if revert is sayed before crazy the punishement will be cancled and the thrown card will be returned to the player and he will continue to play the game.
