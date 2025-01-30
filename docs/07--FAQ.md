
# Frequently Asked Questions

## Can you add [feature request]?

- Maybe! But most likely it will be quite a while before we're able to implement any suggestions. We have a large backlog of major things we want to get done before we start working on other major things. However, if it's a small request, we may be able to implement it sooner.

## How can I batch upscale?

- Any of the iterators.

## Can I link multiple iterators together to do paired [whatever]?

- No. This will be possible once we do our iterator rewrite. For now though, this isn't possible.

## Can you add [random upscaling network] support?

- Maybe. We implement various upscaling architectures in a different way from most other applicatons. Most other apps just make a wrapper around the official CLI version of whatever network it is. We actually integrate the architecture into our code, and do complex parsing to determine the parameters of the models. This results in a really seamless and straightforward user experience, with a downside of it taking a long time to implement each network.

## What does the name mean?

- chaiNNer is a play on the fact that you can "chain" different tasks together, with the NN in the name being a common abbreviation for Neural Networks. This is following the brilliant naming scheme of victorca25's machine learning tools (traiNNer, iNNfer, augmeNNt) which he granted me permission to use for this as well.

## Why not just use Cupscale/IEU/CLI?

- All of these tools are viable options, but as anyone who has used them before knows they can be limited in what they can do. Many features like chaining or interpolating models are hardcoded and provide little flexibility. Certain features that would be useful, like being able to use a separate model on the alpha layer of an image for example, just do not exist in Cupscale. Inversely, you can pretty much do whatever you want with chaiNNer provided there are nodes implemented. Whatever weird feature you want implemented, you can implement yourself by connecting nodes however you want. Cupscale also does not have other image processing abilities like chaiNNer does, such as adjusting contrast.

- Cupscale and IEU are also seemingly no longer maintained at the moment, while chaiNNer is being actively worked on still.

## Wouldn't this make it more difficult to do things?

- In a way, yes. Similarly to how programming your own script to do this stuff is more difficult, chaiNNer will also be a bit more difficult than simply dragging and dropping an image and messing with some sliders and pressing an upscale button. However, this gives you a lot more flexibility in what you can do. The added complexity is really just connecting some dots together to do what you want. That doesn't sound that bad, right?
