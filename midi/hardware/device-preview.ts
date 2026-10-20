import type { MidiDeviceProfile, MidiGuiNode } from './device-profile-schema'

function imageIn(node: MidiGuiNode): MidiGuiNode | undefined {
    if (node.type === 'image') return node
    for (const child of node.children ?? []) {
        const image = imageIn(child)
        if (image) return image
    }
}

export function createMidiDevicePreview(profile: MidiDeviceProfile, root: Document = document): HTMLElement {
    const figure = root.createElement('figure')
    figure.className = 'midi-device-preview'
    figure.dataset.midiProfile = profile.id
    const artwork = imageIn(profile.gui)
    const src = artwork?.src ?? profile.icon
    if (src) {
        const image = root.createElement('img')
        image.src = src
        image.alt = artwork?.alt || `${profile.name} preview`
        image.loading = 'lazy'
        image.decoding = 'async'
        figure.append(image)
    }
    const caption = root.createElement('figcaption')
    const name = root.createElement('strong')
    name.textContent = profile.name
    const description = root.createElement('p')
    description.textContent = profile.description
    caption.append(name, description)
    if (profile.abilities.length) {
        const abilities = root.createElement('p')
        abilities.className = 'midi-device-abilities'
        abilities.textContent = profile.abilities.join(' · ')
        caption.append(abilities)
    }
    for (const [label, url] of [['Manufacturer', profile.manufacturerUrl], ['Product', profile.productUrl],
        ['MIDI documentation', profile.documentation[0]?.url]]) {
        if (!url) continue
        const link = root.createElement('a')
        link.href = url
        link.textContent = label!
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        caption.append(link)
    }
    figure.append(caption)
    return figure
}
