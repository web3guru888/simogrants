-- SIMOGRANTS Seed Data
-- Migration: 0002_seed_data

-- Sample Users
INSERT INTO users (address, display_name, created_at, last_login) VALUES
  ('0x742d35Cc6634C0532925a3b844Bc9e7595f4E6A0', 'Alice (Round Creator)', '2026-03-28T10:00:00Z', '2026-03-30T08:00:00Z'),
  ('0x8ba1f109551bD432803012645Ac136ddd64DBA72', 'Bob (Project Lead)', '2026-03-28T10:05:00Z', '2026-03-30T07:30:00Z'),
  ('0xdD2FD4581271e230360230F9337D5c0430Bf44C0', 'Carol (Evaluator)', '2026-03-28T10:10:00Z', '2026-03-29T18:00:00Z');

-- Sample Grant Rounds
INSERT INTO rounds (id, title, description, creator_address, status, matching_pool, currency, chain, application_deadline, max_applications, evaluation_config, contract_address, created_at, updated_at) VALUES
  ('round-001', 'Ethereum Infrastructure Round 1', 'Funding critical Ethereum infrastructure projects — client diversity, tooling, and protocol development.', '0x742d35Cc6634C0532925a3b844Bc9e7595f4E6A0', 'evaluating', 500000, 'USDC', 'base', '2026-04-15T23:59:59Z', 50,
   '{"enableTensionDetection":true,"tensionThreshold":35,"stakeholderWeights":{"developer":0.3,"user":0.25,"funder":0.25,"ecosystem":0.2}}',
   '0x1234567890abcdef1234567890abcdef12345678', '2026-03-28T12:00:00Z', '2026-03-30T06:00:00Z'),

  ('round-002', 'DeFi Safety & Auditing Round', 'Supporting open-source security auditing tools and DeFi safety infrastructure.', '0x742d35Cc6634C0532925a3b844Bc9e7595f4E6A0', 'accepting', 250000, 'USDC', 'base', '2026-04-20T23:59:59Z', 30,
   '{"enableTensionDetection":true,"tensionThreshold":40,"stakeholderWeights":{"developer":0.35,"user":0.2,"funder":0.3,"ecosystem":0.15}}',
   NULL, '2026-03-29T09:00:00Z', '2026-03-29T09:00:00Z'),

  ('round-003', 'Community Governance Fund', 'Empowering community-driven governance tools and participation mechanisms.', '0x742d35Cc6634C0532925a3b844Bc9e7595f4E6A0', 'funded', 150000, 'USDC', 'base', '2026-03-25T23:59:59Z', 40,
   '{"enableTensionDetection":false,"stakeholderWeights":{"developer":0.2,"user":0.35,"funder":0.2,"ecosystem":0.25}}',
   '0xabcdef1234567890abcdef1234567890abcdef12', '2026-03-20T14:00:00Z', '2026-03-27T10:00:00Z');

-- Sample Projects
INSERT INTO projects (id, name, description, website, github_url, team_size, category, created_by, overall_score, created_at, updated_at) VALUES
  ('proj-001', 'OpenZeppelin', 'Open-source library for secure smart contract development. Provides battle-tested implementations of standards like ERC-20, ERC-721, and access control.', 'https://openzeppelin.com', 'https://github.com/OpenZeppelin/openzeppelin-contracts', 12, 'developer-tooling', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', 88.5, '2026-03-28T14:00:00Z', '2026-03-30T06:00:00Z'),

  ('proj-002', 'Uniswap', 'Decentralized token exchange protocol. The most widely used AMM on Ethereum and L2s.', 'https://uniswap.org', 'https://github.com/Uniswap', 25, 'defi', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', 92.0, '2026-03-28T14:05:00Z', '2026-03-30T06:00:00Z'),

  ('proj-003', 'Gitcoin Passport', 'Verifiable digital identity aggregator for web3. Aggregates stamps from multiple providers to build a sybil-resistant identity.', 'https://passport.gitcoin.co', 'https://github.com/gitcoinco/passport', 8, 'identity', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', 78.3, '2026-03-28T14:10:00Z', '2026-03-30T06:00:00Z'),

  ('proj-004', 'Protocol Guild', 'Salary protocol funding Ethereum protocol developers through on-chain streaming payments.', 'https://protocolguild.org', 'https://github.com/ProtocolGuild', 4, 'governance', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', 85.1, '2026-03-28T14:15:00Z', '2026-03-30T06:00:00Z'),

  ('proj-005', 'EthStaker', 'Community-driven education and tooling for Ethereum staking. Provides guides, monitoring tools, and best practices for node operators.', 'https://ethstaker.cc', 'https://github.com/eth-educators/ethstaker', 6, 'infrastructure', '0x8ba1f109551bD432803012645Ac136ddd64DBA72', 81.7, '2026-03-28T14:20:00Z', '2026-03-30T06:00:00Z');

-- Sample Applications (projects applied to rounds)
INSERT INTO applications (id, round_id, project_id, status, applied_at, evaluated_at) VALUES
  ('app-001', 'round-001', 'proj-001', 'evaluated', '2026-03-29T10:00:00Z', '2026-03-30T04:00:00Z'),
  ('app-002', 'round-001', 'proj-002', 'evaluated', '2026-03-29T10:05:00Z', '2026-03-30T04:00:00Z'),
  ('app-003', 'round-001', 'proj-003', 'evaluated', '2026-03-29T10:10:00Z', '2026-03-30T04:00:00Z'),
  ('app-004', 'round-001', 'proj-004', 'evaluated', '2026-03-29T10:15:00Z', '2026-03-30T04:00:00Z'),
  ('app-005', 'round-001', 'proj-005', 'evaluated', '2026-03-29T10:20:00Z', '2026-03-30T04:00:00Z'),

  ('app-006', 'round-002', 'proj-001', 'submitted', '2026-03-29T15:00:00Z', NULL),
  ('app-007', 'round-002', 'proj-003', 'submitted', '2026-03-29T15:05:00Z', NULL),

  ('app-008', 'round-003', 'proj-002', 'funded', '2026-03-21T10:00:00Z', '2026-03-26T02:00:00Z'),
  ('app-009', 'round-003', 'proj-004', 'funded', '2026-03-21T10:05:00Z', '2026-03-26T02:00:00Z'),
  ('app-010', 'round-003', 'proj-005', 'funded', '2026-03-21T10:10:00Z', '2026-03-26T02:00:00Z');

-- Sample Evaluations
INSERT INTO evaluations (application_id, evaluation_data, overall_score, data_completeness, bradley_terry_rank, evaluated_at) VALUES
  ('app-001', '{"stakeholderScores":{"developer":90,"user":85,"funder":88,"ecosystem":91},"tensions":[{"type":"supply_chain","score":12},{"type":"ecosystem_dependency","score":8}],"summary":"Excellent developer tooling with broad adoption. Minimal tension detected."}', 88.5, 0.95, 2.0, '2026-03-30T04:00:00Z'),

  ('app-002', '{"stakeholderScores":{"developer":95,"user":88,"funder":93,"ecosystem":90},"tensions":[{"type":"supply_chain","score":15},{"type":"ecosystem_dependency","score":5}],"summary":"Top-tier DeFi protocol with massive user base. Strong across all dimensions."}', 92.0, 0.98, 1.0, '2026-03-30T04:00:00Z'),

  ('app-003', '{"stakeholderScores":{"developer":75,"user":82,"funder":70,"ecosystem":86},"tensions":[{"type":"centralization","score":28},{"type":"supply_chain","score":20}],"summary":"Good identity infrastructure but some centralization concerns around stamp providers."}', 78.3, 0.82, 5.0, '2026-03-30T04:00:00Z'),

  ('app-004', '{"stakeholderScores":{"developer":88,"user":80,"funder":85,"ecosystem":87},"tensions":[{"type":"funding_sustainability","score":30},{"type":"ecosystem_dependency","score":10}],"summary":"Important protocol funding mechanism. Moderate tension on long-term funding sustainability."}', 85.1, 0.88, 3.0, '2026-03-30T04:00:00Z'),

  ('app-005', '{"stakeholderScores":{"developer":82,"user":85,"funder":78,"ecosystem":80},"tensions":[{"type":"supply_chain","score":18},{"type":"ecosystem_dependency","score:22}],"summary":"Valuable staking education and tooling. Some supply chain risk with client dependencies."}', 81.7, 0.85, 4.0, '2026-03-30T04:00:00Z'),

  ('app-008', '{"stakeholderScores":{"developer":93,"user":90,"funder":92,"ecosystem":88},"tensions":[{"type":"supply_chain","score":10}],"summary":"Premier DEX protocol. Strong fundamentals."}', 91.5, 0.97, 1.0, '2026-03-26T02:00:00Z'),

  ('app-009', '{"stakeholderScores":{"developer":85,"user":78,"funder":82,"ecosystem":86},"tensions":[{"type":"funding_sustainability","score":32}],"summary":"Unique protocol developer funding. Sustainability concerns."}', 83.0, 0.86, 2.0, '2026-03-26T02:00:00Z'),

  ('app-010', '{"stakeholderScores":{"developer":80,"user":84,"funder":76,"ecosystem":82},"tensions":[{"type":"supply_chain","score":15}],"summary":"Strong community resource for staking education."}', 80.5, 0.84, 3.0, '2026-03-26T02:00:00Z');

-- Sample Allocations (for the funded round-003)
INSERT INTO allocations (round_id, application_id, amount, qf_base, pheromone_modifier, pagerank_modifier, pheromone_state, epoch, computed_at) VALUES
  ('round-003', 'app-008', 62000, 58000, 1.05, 1.02, '{"signal_strength":0.85,"decay_factor":0.95}', 1, '2026-03-27T08:00:00Z'),
  ('round-003', 'app-009', 52000, 48000, 1.08, 1.00, '{"signal_strength":0.78,"decay_factor":0.95}', 1, '2026-03-27T08:00:00Z'),
  ('round-003', 'app-010', 36000, 35000, 1.02, 1.00, '{"signal_strength":0.72,"decay_factor":0.95}', 1, '2026-03-27T08:00:00Z');

-- Sample Pipeline Runs
INSERT INTO pipeline_runs (run_id, round_id, status, config, results, error, started_at, completed_at) VALUES
  ('pipeline-001', 'round-003', 'complete', '{"maxEpochs":10,"convergenceThreshold":0.01}', '{"totalAllocated":150000,"epochs":7,"converged":true}', NULL, '2026-03-26T01:00:00Z', '2026-03-27T08:00:00Z'),
  ('pipeline-002', 'round-001', 'running', '{"maxEpochs":10,"convergenceThreshold":0.01}', NULL, NULL, '2026-03-30T04:00:00Z', NULL);
