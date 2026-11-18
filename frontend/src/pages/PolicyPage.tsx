import { PageHeader } from '../components/layout/PageHeader';
import { Card } from '../components/ui/Card';

const policies = {
  terms: {
    title: 'Terms and conditions',
    description: 'Using Clario for document review.',
    sections: [
      ['Documents you can use', 'Upload material you have permission to process. Follow your organization’s rules for confidential records and for sharing reports or excerpts.'],
      ['Reviewing results', 'Clario helps locate passages, compare revisions, and draft summaries. Check findings and generated text against the source documents before relying on them for a legal or business decision.'],
      ['Software license', 'The project is distributed under the MIT License. Its permission notice and warranty terms are included in the LICENSE file distributed with the source.'],
    ],
  },
  privacy: {
    title: 'Privacy',
    description: 'How documents and review activity move through the workspace.',
    sections: [
      ['Workspace records', 'The Clario server processes uploaded files and stores document content, searchable passages, findings, and workspace settings. People with access to the workspace may be able to view these records.'],
      ['Model connections', 'Features that use a language model can send prompts and relevant document passages to the endpoint configured for this workspace. Check the model connection in Settings before processing sensitive material.'],
      ['Access and retention', 'Use the document library to remove a document. Ask the person operating your workspace about access controls, backups, logs, and how long other records are kept.'],
    ],
  },
  cookies: {
    title: 'Cookies and browser storage',
    description: 'What Clario stores in your browser and on the workspace server.',
    sections: [
      ['Browser behavior', 'Ask Clario saves selected document IDs in this browser so your source selection survives a refresh. Interface state, such as an open sidebar or search dialog, is held in memory.'],
      ['Workspace data', 'Documents and saved review records live on the workspace server. Clearing browser data leaves these records on the server.'],
      ['Deployment settings', 'A sign-in service or proxy added by your workspace operator may set its own cookies. Your browser’s site settings show the cookies in use for this deployment.'],
    ],
  },
};

export function PolicyPage({ policy }: { policy: keyof typeof policies }) {
  const { title, description, sections } = policies[policy];
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <Card className="max-w-3xl divide-y divide-clario-border">
        {sections.map(([heading, body]) => (
          <section key={heading} className="py-5 first:pt-1 last:pb-1">
            <h2 className="font-semibold text-clario-text">{heading}</h2>
            <p className="mt-2 text-sm leading-7 text-clario-text-secondary">{body}</p>
          </section>
        ))}
      </Card>
    </div>
  );
}
