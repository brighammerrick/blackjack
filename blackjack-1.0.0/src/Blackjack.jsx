import React, { useState, useEffect } from 'react';
import './blackjack.css';

const suits = ['♠', '♥', '♣', '♦'];
const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const getCardValue = (card) => {
    if (card.value === 'A') return 11;
    if (['K', 'Q', 'J'].includes(card.value)) return 10;
    return parseInt(card.value);
};

const calculateScore = (hand) => {
    let score = 0, aces = 0;
    hand.forEach(card => {
        score += getCardValue(card);
        if (card.value === 'A') aces++;
    });
    while (score > 21 && aces--) score -= 10;
    return score;
};

const getNewDeck = () => {
    return suits.flatMap(suit => values.map(value => ({ suit, value })))
        .sort(() => Math.random() - 0.5);
};

const canSplit = (hand) => {
    return hand.length === 2 && hand[0].value === hand[1].value;
};

const Blackjack = () => {
    // Load dark mode preference from localStorage or default true
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('blackjack-dark-mode');
        return saved === null ? true : saved === 'true';
    });

    const [deck, setDeck] = useState(getNewDeck());
    const [playerHands, setPlayerHands] = useState([]); // array of hands (arrays)
    const [dealer, setDealer] = useState([]);
    const [gameOver, setGameOver] = useState(true);
    const [message, setMessage] = useState('');
    const [activeHandIndex, setActiveHandIndex] = useState(0);
    const [dealerRevealing, setDealerRevealing] = useState(false);

    // Betting system state
    const [chips, setChips] = useState(() => {
        const stored = localStorage.getItem('chips');
        return stored !== null ? parseInt(stored, 10) : 100;
    });
    const [bet, setBet] = useState('');
    const [doubledHands, setDoubledHands] = useState([]);

    // High Score state (loaded from localStorage)
    const [highScore, setHighScore] = useState(() => {
        const savedHighScore = localStorage.getItem('blackjack-high-score');
        return savedHighScore ? parseInt(savedHighScore) : 100;
    });

    // Persist dark mode preference on change
    useEffect(() => {
        localStorage.setItem('blackjack-dark-mode', darkMode);
    }, [darkMode]);

    // Update localStorage if chips exceed high score
    useEffect(() => {
        if (chips > highScore) {
            setHighScore(chips);
            localStorage.setItem('blackjack-high-score', chips.toString());
        }
    }, [chips, highScore]);

    // Persist chips value on change, reset to 1000 if less than or equal to 0
    const [lostAllChips, setLostAllChips] = useState(false);

    useEffect(() => {
        if (chips < 1 && gameOver) { // <-- changed from chips <= 0
            setLostAllChips(true);
            setMessage("You lost all your chips");
            const timeout = setTimeout(() => {
                setChips(100);
                localStorage.setItem('chips', '100');
                setMessage('');
                setLostAllChips(false);
            }, 3000);
            return () => clearTimeout(timeout);
        } else {
            localStorage.setItem('chips', chips.toString());
        }
    }, [chips, gameOver]);

    // Start a new game only if bet is valid and chips are sufficient
    const deal = () => {
        if (!gameOver) return;
        const betNum = parseInt(bet);
        if (isNaN(betNum) || betNum <= 0) {
            setMessage('Please enter a valid bet.');
            return;
        }
        if (betNum > chips) {
            setMessage("You don't have enough chips.");
            return;
        }

        // Subtract bet from chips immediately
        setChips(prev => prev - betNum);

        const newDeck = getNewDeck();
        const pHand = [newDeck.pop(), newDeck.pop()];
        const dHand = [newDeck.pop(), newDeck.pop()];
        setPlayerHands([pHand]);
        setDealer(dHand);
        setDeck(newDeck);
        setMessage('');
        setGameOver(false);
        setActiveHandIndex(0);
        setDealerRevealing(false);
        setDoubledHands([]); // Reset doubled hands for new round
    };

    // Hit current active hand
    const hit = () => {
        if (gameOver) return;
        const newDeck = [...deck];
        const newPlayerHands = [...playerHands];
        newPlayerHands[activeHandIndex] = [...newPlayerHands[activeHandIndex], newDeck.pop()];
        setDeck(newDeck);
        setPlayerHands(newPlayerHands);

        const score = calculateScore(newPlayerHands[activeHandIndex]);
        if (score > 21) {
            if (activeHandIndex + 1 < newPlayerHands.length) {
                setActiveHandIndex(activeHandIndex + 1);
            } else {
                revealDealer(newPlayerHands);
            }
        }
    };

    // Stand on current active hand
    const stand = () => {
        if (gameOver) return;
        if (activeHandIndex + 1 < playerHands.length) {
            setActiveHandIndex(activeHandIndex + 1);
        } else {
            revealDealer(playerHands);
        }
    };

    // Split current active hand if possible
    const split = () => {
        if (gameOver) return;
        const newDeck = [...deck];
        const newPlayerHands = [...playerHands];
        const handToSplit = newPlayerHands[activeHandIndex];
        if (!canSplit(handToSplit)) return;

    // Only need enough chips for one more bet
        if (chips < parseInt(bet)) {
            setMessage("Not enough chips to split.");
            return;
        }

        const newHand1 = [handToSplit[0], newDeck.pop()];
        const newHand2 = [handToSplit[1], newDeck.pop()];
        newPlayerHands.splice(activeHandIndex, 1, newHand1, newHand2);

        setDeck(newDeck);
        setPlayerHands(newPlayerHands);
        setChips(prev => prev - parseInt(bet)); // Subtract the extra bet for the split
    };

    // Double down on current active hand
    const doubleDown = () => {
        if (gameOver) return;
        if (playerHands[activeHandIndex].length !== 2) return;
        // Only need enough chips for one more bet, since initial bet is already subtracted
        if (chips < parseInt(bet)) return;

        const newDeck = [...deck];
        const newPlayerHands = [...playerHands];
        newPlayerHands[activeHandIndex] = [
            ...newPlayerHands[activeHandIndex],
            newDeck.pop(),
        ];
        setDeck(newDeck);
        setPlayerHands(newPlayerHands);

        // Deduct the extra bet
        setChips((prev) => prev - parseInt(bet));

        // Mark this hand as doubled
        setDoubledHands((prev) => {
            const updated = [...prev];
            updated[activeHandIndex] = true;
            return updated;
        });

        // After double, immediately reveal dealer for all hands
        revealDealer(newPlayerHands);
    };

    // Reveal dealer cards and finalize game
    const revealDealer = (playerHands) => {
        setDealerRevealing(true);
        let newDeck = [...deck];
        let newDealer = [...dealer];
        let dealerScore = calculateScore(newDealer);

        while (dealerScore < 17) {
            newDealer.push(newDeck.pop());
            dealerScore = calculateScore(newDealer);
        }

        let revealIndex = 1;
        const revealInterval = setInterval(() => {
            revealIndex++;
            if (revealIndex > newDealer.length) {
                clearInterval(revealInterval);
                setDealer(newDealer);
                setDeck(newDeck);

                const dScore = calculateScore(newDealer);
                let resultMsg = '';
                let chipsChange = 0;

                playerHands.forEach((hand, i) => {
                    const pScore = calculateScore(hand);
                    const isPlayerBlackjack = hand.length === 2 && pScore === 21;
                    const isDealerBlackjack = dealer.length === 2 && calculateScore(dealer) === 21;
                    const handBet = doubledHands[i] ? parseInt(bet) * 2 : parseInt(bet);

                    if (pScore > 21) {
                        resultMsg += `Hand ${i + 1}: Bust. `;
                        // No chipsChange needed, bet already subtracted
                    } else if (isPlayerBlackjack && !isDealerBlackjack) {
                        resultMsg += `Hand ${i + 1}: Blackjack! `;
                        chipsChange += Math.floor(parseInt(bet) * 2.5); // 3:2 payout + original bet
                    } else if (isDealerBlackjack && isPlayerBlackjack) {
                        resultMsg += `Hand ${i + 1}: Push. `;
                        chipsChange += handBet; // Give back full bet (including double)
                    } else if (dScore > 21) {
                        resultMsg += `Hand ${i + 1}: You win! `;
                        chipsChange += handBet * 2; // Win: double the bet (bet + winnings)
                    } else if (pScore > dScore) {
                        resultMsg += `Hand ${i + 1}: You win! `;
                        chipsChange += handBet * 2; // Win: double the bet (bet + winnings)
                    } else if (pScore === dScore) {
                        resultMsg += `Hand ${i + 1}: Push. `;
                        chipsChange += handBet; // Give back full bet (including double)
                    } else {
                        resultMsg += `Hand ${i + 1}: Dealer wins. `;
                        // No chipsChange needed, bet already subtracted
                    }
                });

                setMessage(resultMsg.trim());
                setChips(prev => Math.max(prev + chipsChange, 0));
                setGameOver(true);
                setDealerRevealing(false);
                setBet('');
            } else {
                setDealer(newDealer.slice(0, revealIndex));
            }
        }, 800);
    };

    const renderCard = (card, index, hideBack = false) => {
        return (
            <div className="card-container" key={index}>
                <div className={`card ${card.suit}${hideBack ? ' flipped' : ''}`}>
                    <div className="card-front">
                        <div className="card-value">{card.value}</div>
                        <div className="card-suit">{card.suit}</div>
                    </div>
                    <div className="card-back"></div>
                </div>
            </div>
        );
    };

    const renderHand = (hand, isDealer = false, hideSecondCard = false) => {
        return (
            <div className="hand">
                {hand.map((card, i) =>
                    isDealer && hideSecondCard && i === 1 ? renderCard(card, i, true) : renderCard(card, i, false)
                )}
            </div>
        );
    };

    const isBlackjack = (hand) => {
        return hand.length === 2 && calculateScore(hand) === 21;
    };

    return (
        <div className={`blackjack ${darkMode ? 'dark' : ''}`}>
            <div className="top-row">
                <button
                    className="toggle-theme"
                    onClick={() => setDarkMode(!darkMode)}
                    aria-label="Toggle light/dark mode"
                >
                    {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>

                <div className="chips-display">Chips: {chips}</div>
            </div>

            <div className="dealer-section">
                <p>
                    <strong>Dealer: </strong>
                    <span className="score">
                        {dealerRevealing || gameOver
                            ? calculateScore(dealer)
                            : dealer.length > 0 ? getCardValue(dealer[0]) : ''}
                    </span>
                </p>
                <div className="high-score-display">
                    High Score: <span id="high-score-count">{highScore}</span>
                </div>
                {renderHand(dealer, true, !dealerRevealing && !gameOver)}
            </div>

            <div className="player-section">
                {playerHands.map((hand, i) => (
                    <div
                        key={i}
                        className={`player-hand ${activeHandIndex === i ? 'active' : ''}`}
                        aria-label={`Player hand ${i + 1}`}
                    >
                        <p>
                            <strong>Hand {i + 1}: </strong>
                            <span className="score">{calculateScore(hand)}</span>
                            {isBlackjack(hand) && ' Blackjack!'}
                        </p>
                        {renderHand(hand)}
                    </div>
                ))}
            </div>

            <div className="bet-section">
                <input
                    type="number"
                    placeholder="Enter your bet"
                    value={bet}
                    onChange={(e) => {
                        const val = e.target.value;
                        if (val === '') setBet('');
                        else setBet(parseInt(val));
                    }}
                    disabled={!gameOver}
                    min="1"
                    max={chips}
                    className="bet-input"
                />
                <button
                    onClick={deal}
                    disabled={!gameOver || bet <= 0 || bet > chips}
                    className="action-button"
                >
                    Deal
                </button>
            </div>

            <div className="action-buttons centered-buttons">
                {!gameOver && (
                    <>
                        <button onClick={hit} className="action-button">
                            Hit
                        </button>
                        <button onClick={stand} className="action-button">
                            Stand
                        </button>
                        {/* Split button */}
                        {canSplit(playerHands[activeHandIndex]) &&
                            chips >= parseInt(bet) && (
                                <button onClick={split} className="action-button">
                                    Split
                                </button>
                            )}

                        {/* Double button */}
                        {playerHands[activeHandIndex]?.length === 2 &&
                            !doubledHands[activeHandIndex] &&
                            chips >= parseInt(bet) && (
                                <button onClick={doubleDown} className="action-button">
                                    Double
                                </button>
                            )}
                    </>
                )}
            </div>

            <div className="payout-info">Blackjack pays 3:2</div>

            {(message && !lostAllChips) && <p className="message">{message}</p>}
            {lostAllChips && <p className="message">You lost all your chips</p>}
        </div>
    );
};

export default Blackjack;
