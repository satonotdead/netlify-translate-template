![image](https://github.com/user-attachments/assets/4bef6ad3-04d2-4342-9d34-0ae7899352dc)

## Ghost-DeepL glue (a Netlify function) ##

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/cathysarisky/netlify-translate-template)



This package receives webhooks from Ghost, sends the post content to DeepL API for translation, then creates new posts in the target languages.

You can create a free DeepL account that provides 500,000 characters of translation per month. Because Netlify also has a generous free tier, this is potentially a free solution to translation for smaller/less prolific Ghost sites.

To use this function, fork this repo, make a Netlify account, and deploy it to Netlify.
(A PR that provides detailed directions for this step or sets up a Deploy to Netlify button would be welcome.)

Use the example.env file to get environment variables set up in Netlify.  (IMPORTANT: Never commit this file with your secrets.  It's best to rename it to .env and make sure it is included in your .gitignore.)  Here's how to get the values you need:

* Get your DeepL API key by signing up here: https://www.deepl.com/en/pro-api (Note that the API plans and other plans are not the same. You need an API plan.)  Copy it into the.env file.

* Get your Ghost API key and url by going to /ghost > settings (gear icon) > integrations, clicking "custom", and adding a new integration. Copy these into the .env file.

* While you're on the integration page, click "Add webhook".  Create a new webhook, named anything you like.  The trigger is "Post published".  The url is {whatever your Netlify site's url is, starting with https}/.netlify/functions/translator .  Choose your own webhook secreit.  Copy the webhook secret to the example.env file.

Go to your Netlify deploy, and import the .env (really copy-paste).

Deploy the site.  (You have to do this any time you change environment variables.)

Also included is an example routes.yaml file that can be used to put each translation in its own part of Ghost.

## Tips ##
* The function looks for a tag called #translated, and aborts if it finds it.  This stops newly published translations from triggering the translation function, which can otherwise cause a chain reaction. (Ask me how I know. Or don't.)

* Use the routes.yaml file (after editing it for your languages) to get basic collections in each language.  Each translation gets a tag (like #ES) to denote its language.

## Thanks & Support ##
* If you'd like me to set this up for you, feel free to hire me for an hour: https://tidycal.com/catsarisky/60-minute-paid
* Tip Jar: https://www.spectralwebservices.com/tipjar/ 
* Sponsor on Github: https://github.com/sponsors/cathysarisky


