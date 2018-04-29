// Stupid animated page title
((doc, win) => {
    const customTitle = 'tyler vick';
    const title = customTitle || doc.title;
    doc.title = '>';

    let blinkingToggle, done = false;
    const showBlinkingUnderscore = () => {
        let counter = 0;
        const timer = setInterval(() => {
            doc.title = blinkingToggle ?
                doc.title.slice(0, -1) : doc.title + '\u005F';
            blinkingToggle = !blinkingToggle;
            counter++;
            if (counter > 40) { // run for 20 seconds
                clearInterval(timer);
            }
        }, 500);
    };


    let titleArr = title.split('');
    let timerMultiplier = 0;

    for (let a = 0; a < titleArr.length; a++) {
        timerMultiplier++;
        if (a === titleArr.length - 1) {
            done = true;
        }
        ((letter, tm, done) => {
            setTimeout(() => {
                if (letter === ' ') {
                    letter = '\u205f​​​';
                }
                doc.title = doc.title + letter;

                if (done) {
                    showBlinkingUnderscore();
                }
            }, 250 * tm);
        })(titleArr[a], timerMultiplier, done);
    }
})(document, window);
