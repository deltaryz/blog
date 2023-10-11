# Blog Postmortem - The Anarchy of HTML/CSS/JS

Not too long ago, the concept of postmortems was planted in my head. I had submitted an entry for [GBJam 11](https://deltaryz.com/gbjam11), and while browsing other submissions, I encountered multiple postmortem posts which detailed the author's feelings about the creation and development of their project. It was immediately clear that I should [do that myself](https://deltaryz.itch.io/gbgoes2space/devlog/611707/gbjam-11-postmortem) - and maybe even keep doing it for future projects as well.

So here I am, in the future, with another project.

A confession: this isn't my first blog. I did have one previously based on [WriteFreely](https://writefreely.org/), which markets itself using phrases like "Light & Easy to Install" and "distraction-free writing environment". These are lies. I ran into far, far too many issues getting the database to read and write properly, to handle HTTPS, to make sure the weird account and permission system I didn't need was configured and logged in properly...

...and after I had everything figured out and working, it just randomly stopped working for no apparent reason a few months later. It was running in Docker, how does that even happen?

That was *precisely* the kind of experience I wanted to avoid, and why WriteFreely's brand identity as "the minimal and easy to use alternative" was appealing to me in the first place. Well, turns out you can't trust anyone, and the only way to ensure something works in a way I am happy with is to create it myself.

My code isn't clean. I've probably somehow violated the Geneva Convention with the atrocious ways I've crowbarred certain parts of this site together. Maybe I'll regret this later, but at least for now, this is still easily the best and most comfortable solution for me personally.

It's still, somehow, easier for me to work with compared to WriteFreely.

# Past Lessons

I've done a number of web development projects before - examples including my now-defunct domain [cameronseid.com](https://github.com/deltaryz/cameronseid.com), [e669](https://github.com/deltaryz/e669), and its rewrite [e669-neo](https://github.com/deltaryz/e669-neo). I learned a lot during those projects, perhaps most significantly, I *really* didn't like working with Bootstrap or Materialize.

All of my experiences with major libraries, CSS frameworks, et cetera feel like they try so desperately to impose a very specific design ethos and workflow upon you. They also do a pretty terrible job explaining the logic or reasoning behind it, or what you need to stop doing because it will interfere. God help you if you are trying to combine multiple different libraries, each imposing their own brand new vocabulary and design paradigms.

In contrast, vanilla HTML/JS/CSS does not impose any design ethos or workflow. It is total anarchy. You can get away with anything. You can use HTML tags that have been deprecated for 15 years and most (but not all) browsers still implement them. You can shove variables inside CSS inside HTML inside JavaScript *to edit the page at runtime* (which I've done more than I would like to admit).

Definitely a real "pick your poison" scenario. Admittedly, I haven't tried everything - maybe I just haven't seen the light yet. I will continue experimenting and learning as I always have, but for now, I can vouch for the vanilla-ish web stack to be my preferred toolset. At least with this, if something becomes a confusing mess that's hard to work with, I can only blame myself.

This state of affairs is precisely why I think web development is an *abysmal* way to learn programming. There are no rails holding you back from creating an utter atrocity of bad code, and when a library tries to set up some rails, it often feels like it creates more problems than it fixes. Web development sucks, but honestly, at least for some projects it's a type of suck I actually kinda enjoy and benefit from.

The main takeaway was this time, I had to keep my dependencies extremely minimal. I can impose whatever structure (or lack of structure) I want, and everything makes sense.

As an alternative to Materialize, I discovered [MUI CSS](https://www.muicss.com/) which is wonderful. It's nothing overkill or complicated, it is essentially just some pre-made CSS classes that implement Material styling in a deliciously non-intrusive way. I already became familiar with it working on [e669-neo](https://github.com/deltaryz/e669-neo), meaning I was not learning any brand-new technologies to create this blog.


# The Core Objective

I had a very clear vision of how I wanted this blog to function, and I am quite happy with my implementation of that vision. The core thesis, the absolute most important features:

- Blog posts are nothing more than [markdown files](https://github.com/deltaryz/blog/tree/main/posts)
- Writing and publishing one is no more complex than a git commit

As an optional bonus objective:

- The frontend of the site itself updates from the same git repo

Though my methods for achieving the desired functionality are dirty, I did achieve each of these things. It's effectively zero-maintenance, I can update both the site's code and the posts on it without ever needing to touch my webserver.

This means the bog-standard post writing experience is no more complicated than opening Notepad, writing my essay, and then clicking a button to upload it. The previews on the home page, Discord/Twitter rich embeds, etc are all constructed automatically.

Because I have full control over the logic of how everything is rendered and processed, introducing more unique or interactive elements is completely doable as well. If needed, I can introduce entire new features to the site to facilitate the needs of my posts. It's exactly as complicated or as simple as it needs to be.
 
# What I Learned From This

If you'd like to witness some of my worst crimes against programming, I direct your eyes to [makehtml.ts](https://github.com/deltaryz/blog/blob/main/makehtml.ts). The whole file is a mess, and the ways I manipulate raw HTML text in here felt dirty to implement. But you know what? It works, it feels good, and clearly that has motivated me to work on it. I understand it well enough that I can fix or improve it whenever its clunkiness gets in the way of something.

As much as I like to imagine myself being able to write super clean and efficient code, spending 9999 hours making everything perfect the first time, that's simply just not how my brain actually works. That's a one-way trip to exhaustion, burnout, and having nothing to show for it.

When I let myself do things dirty, to focus on getting it working first and working *well* later, that's the only way I get anything working at all. You're reading this now, that's proof. I can let my ADHD brain vomit ideas in whatever disorganized hackjob way it wants, and even if I have to rewrite it from scratch later because my first implementation was horrendous, to a brain like mine the lowest-resistance path is often the *only* path I can take to actually reach my destination. Perfectionism is the enemy of progress.

Besides, it's not like most people actually look at the code. Would you believe this site was built questionably if I hadn't told you? Maybe it's not even really that bad and I'm just being hard on myself. I do think the final product looks pretty nice, if you don't mind me indulging in a little self-flagellation. The important thing is I actually have something to show for my efforts, and you're looking at it now.

Web development seems like a strangely good fit for this kind of freeform workflow, between the anarchistic anything-goes nature of actually working with it, and the unbeatable accessibility of being 1 click or tap away. I can hack something together in whatever way immediately comes to mind without restriction, and get instant feedback by linking it to people, maintaining a positive feedback loop and pushing me to keep working. It just seems like, introducing external dependencies often gets in the way of this process (despite claiming to do the opposite).

Or perhaps I just haven't found the right one yet, who knows? Either way, web development is ass.

But for some projects, it's the *perfect* kind of ass.

# What Now?

Perhaps the word "postmortem" is a little inappropriate, since this is more like *birth* rather than death. I intend to keep using this blog, posting on it, evolving and developing it to represent myself, my thoughts, and my projects.

I may eventually add an art portfolio, and develop this into a hub for my creative endeavors to exist under one umbrella. Having a fully self-hosted and self-designed site also brings the peace of mind that, as long as I am alive and keep paying my server/domain bills, nothing aside from myself can render it inaccessible (or worse: user-unfriendly). I may also write guides and tutorials, particularly for the things I had to spend hours figuring out for myself. I am often dissatisfied with the state of existing documentation and tutorials, and it seems "taking matters into my own hands" is working out for me.

I am already feeling a sense of pride, connection, and commitment to this blog I was never able to feel with ready-made blog solutions. I built this myself, according to my very specific vision of how I wanted it to work, informed by the challenges I had faced before. I know exactly how it works, and I can always expand its functionality if needed. That's a sense of accomplishment I deeply needed.

It's been a few years since I've really put any creative work out into the world like this. Many of my profiles stagnated, and I began to feel distant from not only the things I create, but also myself. Now that I've been working on things like this blog, my project for GBJam, associated graphic design... it really feels like a part of myself is starting to re-awaken. It's good to be back.

Forgive me for this.

∆•RYZ has aryzen once again.