import { useState, useEffect } from 'react'
import './App.css'

// API URL - will use relative path for both dev and production
// For local dev, use: npx vercel dev
// For production, this will automatically work with Vercel
const API_URL = '/api/sheets'

function App() {
  const [gifts, setGifts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [claimingId, setClaimingId] = useState(null)
  const [claimName, setClaimName] = useState('')
  const [confirmedGift, setConfirmedGift] = useState(null)
  const [myClaimedGifts, setMyClaimedGifts] = useState([])
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // Use AbortController to cancel duplicate requests (e.g., from React StrictMode)
    const abortController = new AbortController()

    // Fetch gifts once and use the data for both unclaimed and claimed gifts
    const initialize = async () => {
      try {
        setLoading(true)
        const response = await fetch(API_URL, { signal: abortController.signal })
        if (!response.ok) {
          throw new Error('Failed to fetch gifts')
        }
        const allGifts = await response.json()
        
        // Process unclaimed gifts
        const unclaimedGifts = allGifts.filter(gift => !gift.claimedBy || gift.claimedBy.trim() === '')
        setGifts(unclaimedGifts)
        
        // Process claimed gifts using the same data
        await loadAllClaimedGifts(allGifts)
      } catch (err) {
        // Ignore abort errors
        if (err.name === 'AbortError') {
          return
        }
        setError(err.message)
        console.error('Error fetching gifts:', err)
      } finally {
        // Only update loading state if not aborted
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
      
      // Auto-fill name input with saved username
      if (!abortController.signal.aborted) {
        const savedUserName = localStorage.getItem('giftRegistryUserName')
        if (savedUserName) {
          setUserName(savedUserName)
          setClaimName(savedUserName)
        }
      }
    }
    
    initialize()

    // Cleanup: abort the request if component unmounts or effect re-runs
    return () => {
      abortController.abort()
    }
  }, [])

  const loadAllClaimedGifts = async (allGiftsData = null) => {
    // Check for old localStorage format and migrate if needed
    const oldClaimedGifts = localStorage.getItem('claimedGifts')
    if (oldClaimedGifts) {
      try {
        const oldGifts = JSON.parse(oldClaimedGifts)
        if (Array.isArray(oldGifts) && oldGifts.length > 0) {
          // Migrate: extract IDs from old format
          const migratedIds = oldGifts.map(gift => gift.id).filter(id => id)
          if (migratedIds.length > 0) {
            localStorage.setItem('claimedGiftIds', JSON.stringify(migratedIds))
          }
          // Remove old format
          localStorage.removeItem('claimedGifts')
        }
      } catch (e) {
        console.error('Error migrating old localStorage format:', e)
        // If migration fails, remove old data
        localStorage.removeItem('claimedGifts')
      }
    }

    // Load claimed gift IDs from localStorage
    const savedGiftIds = localStorage.getItem('claimedGiftIds')
    if (!savedGiftIds) {
      setMyClaimedGifts([])
      return
    }

    try {
      const giftIds = JSON.parse(savedGiftIds)
      if (!Array.isArray(giftIds) || giftIds.length === 0) {
        setMyClaimedGifts([])
        return
      }

      // Use provided data or fetch if not provided
      let allGifts = allGiftsData
      if (!allGifts) {
        const response = await fetch(API_URL)
        if (!response.ok) {
          throw new Error('Failed to fetch gifts')
        }
        allGifts = await response.json()
      }

      // Filter gifts by stored IDs and check if they're still claimed
      const validGiftIds = []
      const claimedGifts = []

      for (const giftId of giftIds) {
        const gift = allGifts.find(g => g.id === giftId)
        if (gift) {
          // If claimedBy is empty, remove it from localStorage (gift was unclaimed)
          if (!gift.claimedBy || gift.claimedBy.trim() === '') {
            // Don't add to claimedGifts, and don't add ID to validGiftIds
            continue
          }
          // Gift is still claimed, include it
          claimedGifts.push(gift)
          validGiftIds.push(giftId)
        }
      }

      // Update localStorage to remove unclaimed gifts
      if (validGiftIds.length !== giftIds.length) {
        if (validGiftIds.length === 0) {
          localStorage.removeItem('claimedGiftIds')
        } else {
          localStorage.setItem('claimedGiftIds', JSON.stringify(validGiftIds))
        }
      }

      setMyClaimedGifts(claimedGifts)
    } catch (e) {
      console.error('Error loading claimed gifts:', e)
      setMyClaimedGifts([])
    }
  }

  const loadMyClaimedGifts = (name) => {
    loadAllClaimedGifts()
  }

  const saveClaimedGift = (giftId, name, allGiftsData = null) => {
    const savedGiftIds = localStorage.getItem('claimedGiftIds')
    let claimedGiftIds = savedGiftIds ? JSON.parse(savedGiftIds) : []
    
    // Add the new gift ID if it's not already in the list
    if (!claimedGiftIds.includes(giftId)) {
      claimedGiftIds.push(giftId)
      localStorage.setItem('claimedGiftIds', JSON.stringify(claimedGiftIds))
    }
    
    // Save the user's name for auto-fill
    localStorage.setItem('giftRegistryUserName', name)
    setUserName(name)
    
    // If we have all gifts data, update claimed gifts directly without another API call
    if (allGiftsData) {
      const claimedGifts = []
      for (const id of claimedGiftIds) {
        const gift = allGiftsData.find(g => g.id === id)
        if (gift && gift.claimedBy && gift.claimedBy.trim() !== '') {
          claimedGifts.push(gift)
        }
      }
      setMyClaimedGifts(claimedGifts)
    } else {
      // Reload all claimed gifts from API (only if we don't have the data)
      loadAllClaimedGifts()
    }
  }

  const fetchGifts = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      setError(null)
      const response = await fetch(API_URL)
      if (!response.ok) {
        throw new Error('Failed to fetch gifts')
      }
      const data = await response.json()
      // Filter out claimed gifts (where claimedBy is not empty)
      const unclaimedGifts = data.filter(gift => !gift.claimedBy || gift.claimedBy.trim() === '')
      setGifts(unclaimedGifts)
      return data // Return all gifts for use in claimGift
    } catch (err) {
      setError(err.message)
      console.error('Error fetching gifts:', err)
      return null
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  const claimGift = async (giftId, name) => {
    if (!name.trim()) {
      alert('Please enter your name')
      return
    }

    try {
      setClaimingId(giftId)
      const giftToClaim = gifts.find(g => g.id === giftId)
      
      // Get current timestamp in ISO format
      const claimedDate = new Date().toISOString()
      
      // Show confirmation immediately with local data (optimistic update)
      const optimisticGift = {
        ...giftToClaim,
        claimedBy: name.trim(),
        claimedDate: claimedDate
      }
      setConfirmedGift(optimisticGift)
      
      // Remove claimed gift from list immediately
      setGifts(gifts.filter(gift => gift.id !== giftId))
      setClaimName('')
      setClaimingId(null)

      // Make the PATCH request
      const response = await fetch(`${API_URL}?id=${giftId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            claimedBy: name.trim(),
            claimedDate: claimedDate
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to claim gift')
      }

      // Refresh data in the background (without showing loading)
      // Fetch once to get all updated data
      const allGiftsData = await fetchGifts(false) // Don't show loading
      
      if (allGiftsData) {
        // Update confirmed gift with fresh data from API
        const updatedGift = allGiftsData.find(g => g.id === giftId)
        if (updatedGift) {
          setConfirmedGift(updatedGift)
        }
        
        // Update claimed gifts list using the fetched data
        saveClaimedGift(giftId, name.trim(), allGiftsData)
      } else {
        // Fallback: just save the ID and refresh claimed gifts normally
        saveClaimedGift(giftId, name.trim())
      }
    } catch (err) {
      // Revert optimistic update on error
      setConfirmedGift(null)
      // Re-add gift to list
      await fetchGifts(false)
      setError(err.message)
      console.error('Error claiming gift:', err)
      alert('Failed to claim gift. Please try again.')
      setClaimingId(null)
    }
  }

  const generateCalendarEvent = () => {
    if (!confirmedGift) return
    
    const wrapStatus = confirmedGift.shouldWrap === 'TRUE' ? 'wrapped' : 'unwrapped'
    const deliverBy = new Date('2024-12-10')
    
    // Format date for ICS (YYYYMMDDTHHMMSS)
    const formatICSDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    }
    
    const startDate = formatICSDate(deliverBy)
    const endDate = formatICSDate(new Date(deliverBy.getTime() + 60 * 60 * 1000)) // 1 hour event
    
    const description = `Gift Item: ${confirmedGift.item}\n` +
      `Deliver to: ${confirmedGift.deliverTo || 'N/A'}\n` +
      `Status: Please deliver ${wrapStatus} gift\n` +
      `${confirmedGift.other ? `Notes: ${confirmedGift.other}\n` : ''}` +
      `${confirmedGift.url ? `Product Link: ${confirmedGift.url}\n` : ''}`
    
    const summary = `Deliver ${confirmedGift.item} - Sub-for-Santa`
    const location = confirmedGift.deliverTo || 'TBD'
    
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Sub-for-Santa//Gift Registry//EN',
      'BEGIN:VEVENT',
      `UID:${Date.now()}@subforsanta`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description.replace(/\n/g, '\\n')}`,
      `LOCATION:${location}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n')
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `sub-for-santa-${confirmedGift.item.replace(/\s+/g, '-')}.ics`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const copyDetailsToClipboard = async () => {
    if (!confirmedGift) return
    
    const wrapStatus = confirmedGift.shouldWrap === 'TRUE' ? 'wrapped' : 'unwrapped'
    
    const details = `Gift Details - Sub-for-Santa

Item: ${confirmedGift.item}
Deliver to: ${confirmedGift.deliverTo || 'N/A'}
Please deliver the ${wrapStatus} gift to ${confirmedGift.deliverTo || 'the specified location'} by December 10th at the latest.

${confirmedGift.other ? `Additional Notes: ${confirmedGift.other}\n` : ''}
${confirmedGift.url ? `Product Link: ${confirmedGift.url}` : ''}

Claimed by: ${confirmedGift.claimedBy}`
    
    try {
      await navigator.clipboard.writeText(details)
      alert('Gift details copied to clipboard!')
    } catch (err) {
      console.error('Failed to copy:', err)
      alert('Failed to copy details. Please try the calendar download option.')
    }
  }

  const closeConfirmation = () => {
    setConfirmedGift(null)
  }

  const handleClaimClick = (giftId) => {
    setClaimingId(giftId)
    // Auto-fill with saved username if available
    const savedUserName = localStorage.getItem('giftRegistryUserName')
    setClaimName(savedUserName || '')
  }

  const handleClaimSubmit = (giftId) => {
    claimGift(giftId, claimName)
  }

  const handleCancelClaim = () => {
    setClaimingId(null)
    setClaimName('')
  }

  // Skeleton Loading Component
  const SkeletonGiftCard = () => (
    <div className="gift-card skeleton-gift-card">
      <div className="gift-image">
        <div className="skeleton-image shimmer"></div>
      </div>
      <div className="gift-content">
        <div className="skeleton-text medium shimmer"></div>
        <div className="skeleton-text short shimmer"></div>
        <button className="claim-button" disabled>
          Give this gift
        </button>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="container">
        <header>
          <h1>Grove Park 6th Ward Sub-for-Santa</h1>
          <p>Help spread joy this holiday season by selecting a gift to purchase</p>
        </header>
        <div className="gifts-grid">
          <SkeletonGiftCard />
          <SkeletonGiftCard />
          <SkeletonGiftCard />
          <SkeletonGiftCard />
          <SkeletonGiftCard />
          <SkeletonGiftCard />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container">
        <div className="error">Error: {error}</div>
        <button onClick={fetchGifts} className="retry-button">Retry</button>
      </div>
    )
  }

  // Confirmation Modal Component
  const ConfirmationModal = () => {
    if (!confirmedGift) return null
    
    const wrapStatus = confirmedGift.shouldWrap === 'TRUE' ? 'wrapped' : 'unwrapped'
    
    return (
      <div className="modal-overlay" onClick={closeConfirmation}>
        <div className="confirmation-modal" onClick={(e) => e.stopPropagation()}>
          <div className="confirmation-header">
            <h2>Thank You</h2>
          </div>
          
          <div className="confirmation-content">
            <div className="confirmed-gift-image">
              {confirmedGift.previewUrl ? (
                <img 
                  src={confirmedGift.previewUrl.replace(/\\/g, '')} 
                  alt={confirmedGift.item}
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.parentElement.innerHTML = '<div class="no-preview-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>No preview</span></div>'
                  }}
                />
              ) : (
                <div className="no-preview-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>No preview</span>
                </div>
              )}
            </div>
            
            <div className="confirmed-gift-details">
              <h3 className="confirmed-item-name">{confirmedGift.item}</h3>
              
              {confirmedGift.shouldWrap === 'TRUE' && (
                <p className="gift-badge">🎀 Needs wrapping</p>
              )}
              
              {confirmedGift.shouldWrap === 'FALSE' && (
                <p className="gift-badge no-wrap">📦 Do not wrap</p>
              )}
              
              {confirmedGift.other && (
                <div className="confirmed-notes">
                  <strong>Additional Notes:</strong>
                  <p>{confirmedGift.other}</p>
                </div>
              )}
              
              {confirmedGift.url && (
                <div className="product-url-section">
                  <strong>Product URL:</strong>
                  <a 
                    href={confirmedGift.url.replace(/\\/g, '')} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="product-url-link"
                  >
                    {confirmedGift.url.replace(/\\/g, '')}
                  </a>
                </div>
              )}
              
              <div className="delivery-instructions">
                <h4>📦 Delivery Instructions</h4>
                <p className="delivery-message">
                  Please deliver the <strong>{wrapStatus}</strong> gift to <strong>{confirmedGift.deliverTo || 'the specified location'}</strong> by <strong>December 10th</strong> at the latest.
                </p>
              </div>
            </div>
          </div>
          
          <div className="confirmation-actions">
            <h4 className="save-title">Save this information for later:</h4>
            <div className="save-buttons">
              <button 
                onClick={generateCalendarEvent}
                className="save-button calendar-button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Add to Calendar
              </button>
              <button 
                onClick={copyDetailsToClipboard}
                className="save-button clipboard-button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy Details
              </button>
            </div>
            <button 
              onClick={closeConfirmation}
              className="close-confirmation-button"
            >
              Continue Browsing
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <ConfirmationModal />
      <header>
        <h1>Grove Park 6th Ward Sub-for-Santa</h1>
        <p>Help spread joy this holiday season by selecting a gift to purchase</p>
      </header>

      {myClaimedGifts.length > 0 && (
        <div className="claimed-section">
          <h2 className="section-title">Your Claimed Gifts</h2>
          <div className="gifts-grid claimed-gifts">
            {myClaimedGifts.map((gift) => (
              <div 
                key={gift.id} 
                className="gift-card claimed-card"
                onClick={() => setConfirmedGift(gift)}
                style={{ cursor: 'pointer' }}
              >
                <div className="gift-image">
                  {gift.previewUrl ? (
                    <img 
                      src={gift.previewUrl.replace(/\\/g, '')} 
                      alt={gift.item}
                      onError={(e) => {
                        e.target.style.display = 'none'
                        const placeholder = document.createElement('div')
                        placeholder.className = 'no-preview-placeholder'
                        placeholder.innerHTML = `
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <circle cx="8.5" cy="8.5" r="1.5"/>
                            <polyline points="21 15 16 10 5 21"/>
                          </svg>
                          <span>No preview</span>
                        `
                        e.target.parentElement.appendChild(placeholder)
                      }}
                    />
                  ) : (
                    <div className="no-preview-placeholder">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <span>No preview</span>
                    </div>
                  )}
                </div>
                
                <div className="gift-content">
                  <h2 className="gift-title">{gift.item}</h2>
                  
                  {gift.shouldWrap === 'TRUE' && (
                    <p className="gift-badge">🎀 Needs wrapping</p>
                  )}
                  
                  {gift.shouldWrap === 'FALSE' && (
                    <p className="gift-badge no-wrap">📦 Do not wrap</p>
                  )}
                  
                  {gift.other && (
                    <p className="gift-notes">{gift.other}</p>
                  )}
                  
                  {gift.url && (
                    <a 
                      href={gift.url.replace(/\\/g, '')} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="gift-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View Product →
                    </a>
                  )}
                  
                  <div className="claimed-badge">✓ Claimed by you - Tap to view details</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myClaimedGifts.length > 0 && gifts.length > 0 && (
        <h2 className="section-title">Available Gifts</h2>
      )}

      {gifts.length === 0 && myClaimedGifts.length === 0 ? (
        <div className="empty-state">
          <p>All gifts have been given! 🎉</p>
        </div>
      ) : gifts.length === 0 && myClaimedGifts.length > 0 ? (
        <div className="empty-state">
          <p>No more gifts available, but you've claimed {myClaimedGifts.length} gift{myClaimedGifts.length > 1 ? 's' : ''}! 🎉</p>
        </div>
      ) : (
        <div className="gifts-grid">
          {gifts.map((gift) => (
            <div key={gift.id} className="gift-card">
              <div className="gift-image">
                {gift.previewUrl ? (
                  <img 
                    src={gift.previewUrl.replace(/\\/g, '')} 
                    alt={gift.item}
                    onError={(e) => {
                      e.target.style.display = 'none'
                      const placeholder = document.createElement('div')
                      placeholder.className = 'no-preview-placeholder'
                      placeholder.innerHTML = `
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        <span>No preview</span>
                      `
                      e.target.parentElement.appendChild(placeholder)
                    }}
                  />
                ) : (
                  <div className="no-preview-placeholder">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <span>No preview</span>
                  </div>
                )}
              </div>
              
              <div className="gift-content">
                <h2 className="gift-title">{gift.item}</h2>
                
                {gift.shouldWrap === 'TRUE' && (
                  <p className="gift-badge">🎀 Needs wrapping</p>
                )}
                
                {gift.shouldWrap === 'FALSE' && (
                  <p className="gift-badge no-wrap">📦 Do not wrap</p>
                )}
                
                {gift.other && (
                  <p className="gift-notes">{gift.other}</p>
                )}
                
                {gift.url && (
                  <a 
                    href={gift.url.replace(/\\/g, '')} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="gift-link"
                  >
                    View Product →
                  </a>
                )}

                {claimingId === gift.id ? (
                  <div className="claim-form">
                    <input
                      type="text"
                      placeholder="Enter your name"
                      value={claimName}
                      onChange={(e) => setClaimName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleClaimSubmit(gift.id)
                        }
                      }}
                      className="name-input"
                      autoFocus
                    />
                    <div className="claim-buttons">
                      <button
                        onClick={() => handleClaimSubmit(gift.id)}
                        className="claim-button submit"
                        disabled={!claimName.trim()}
                      >
                        Confirm
                      </button>
                      <button
                        onClick={handleCancelClaim}
                        className="claim-button cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleClaimClick(gift.id)}
                    className="claim-button"
                  >
                    Give this gift
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App

